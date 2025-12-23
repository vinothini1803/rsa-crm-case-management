import { Request, Response } from "express";
import { Op, QueryTypes } from "sequelize";
import {
  CaseDetails,
  AgentProductivityLogs,
  Activities,
} from "../database/models";
import sequelize from "../database/connection";
import axios from "axios";
import moment from "moment-timezone";
import config from "../config/config.json";
import Utils from "../lib/utils";

//API with endpoint (User Service);
const userServiceUrl = `${config.userService.host}:${config.userService.port}/${config.userService.version}/${config.userService.serviceAccess.user}`;
const userServiceEndpoint = config.userService.endpoint;

const defaultLimit = 10;
const defaultOffset = 0;

// Active window durations (in minutes)
const L1_ACTIVE_WINDOW_MINUTES = parseInt(process.env.AGENT_PRODUCTIVITY_L1_ACTIVE_WINDOW_MINUTES || '3');
const L2_ACTIVE_WINDOW_MINUTES = parseInt(process.env.AGENT_PRODUCTIVITY_L2_ACTIVE_WINDOW_MINUTES || '5');

// Type definitions for time windows
interface TimeWindow {
  start: moment.Moment;
  end: moment.Moment;
}

export namespace agentProductivityController {
  /**
   * Get working windows (login-logout intervals) for an agent on a specific date
   * Queries userLogs table from User-Service database
   * Handles:
   * - Multiple login/logout sessions
   * - Current time if day not completed and agent still logged in
   * - Day end if day completed and agent still logged in
   */
  async function getWorkingWindows(
    agentId: number,
    date: string
  ): Promise<TimeWindow[]> {
    try {
      const targetDate = moment.tz(date, "Asia/Kolkata");
      const startOfDay = targetDate.clone().startOf("day");
      const endOfDay = targetDate.clone().endOf("day");
      const now = moment.tz("Asia/Kolkata");
      const today = now.format("YYYY-MM-DD");

      // Query userLogs from User-Service database
      // Only get sessions that are relevant to the target date:
      // 1. Login happened on the target date, OR
      // 2. Logout happened on the target date
      // NOTE: Sessions from previous days are excluded to prevent incorrect idleTime calculations
      const userLogs: any[] = await sequelize.query(
        `SELECT loginDateTime, logoutDateTime 
         FROM \`rsa-crm-user\`.userLogs 
         WHERE userId = :agentId 
           AND deletedAt IS NULL
           AND (
             (loginDateTime >= :startOfDay AND loginDateTime <= :endOfDay)
             OR (logoutDateTime >= :startOfDay AND logoutDateTime <= :endOfDay)
           )
         ORDER BY loginDateTime ASC`,
        {
          type: QueryTypes.SELECT,
          replacements: {
            agentId: agentId,
            startOfDay: startOfDay.format("YYYY-MM-DD HH:mm:ss"),
            endOfDay: endOfDay.format("YYYY-MM-DD HH:mm:ss"),
          },
        }
      );

      const windows: TimeWindow[] = [];

      for (const log of userLogs) {
        if (!log.loginDateTime) continue;

        const loginTime = moment.tz(log.loginDateTime, "Asia/Kolkata");
        let logoutTime: moment.Moment;

        if (log.logoutDateTime) {
          // Agent has logged out
          logoutTime = moment.tz(log.logoutDateTime, "Asia/Kolkata");
        } else {
          // Agent has not logged out yet - set logout time as current date time
          logoutTime = now.clone();
        }

        // Clip to day boundaries
        const windowStart = loginTime.isBefore(startOfDay)
          ? startOfDay.clone()
          : loginTime;
        const windowEnd = logoutTime.isAfter(endOfDay)
          ? endOfDay.clone()
          : logoutTime;

        if (windowStart.isBefore(windowEnd) || windowStart.isSame(windowEnd)) {
          windows.push({ start: windowStart, end: windowEnd });
        }
      }

      // Merge overlapping windows
      const mergedWindows = mergeTimeWindows(windows);

      // Get break/lunch windows and exclude them from working windows
      const breakLunchWindows = await getBreakLunchWindows(agentId, date);
      const adjustedWindows = excludeBreakLunchFromWorkingWindows(
        mergedWindows,
        breakLunchWindows
      );

      // console.log("------start-----------------------")
      // console.log("agentId")
      // console.log(agentId)
      // console.log("mergedWindows")
      // console.log(mergedWindows)
      // console.log("breakLunchWindows")
      // console.log(breakLunchWindows)
      // console.log("finalWorkingWindows")
      // console.log(adjustedWindows)
      

      return adjustedWindows;
    } catch (error: any) {
      return [];
    }
  }

  /**
   * Get break/lunch windows for an agent on a specific date
   * Queries userBreakLogs table from User-Service database
   * Only includes completed breaks/lunches (endDateTime IS NOT NULL)
   * Break status: 1058, Lunch status: 1060
   */
  async function getBreakLunchWindows(
    agentId: number,
    date: string
  ): Promise<TimeWindow[]> {
    try {
      const targetDate = moment.tz(date, "Asia/Kolkata");
      const startOfDay = targetDate.clone().startOf("day");
      const endOfDay = targetDate.clone().endOf("day");

      // Query userBreakLogs from User-Service database
      // Only get completed breaks/lunches (endDateTime IS NOT NULL)
      const breakLunchLogs: any[] = await sequelize.query(
        `SELECT startDateTime, endDateTime 
         FROM \`rsa-crm-user\`.userBreakLogs 
         WHERE userId = :agentId 
           AND date = :date
           AND userStatus IN (1058, 1060)
           AND endDateTime IS NOT NULL
         ORDER BY startDateTime ASC`,
        {
          type: QueryTypes.SELECT,
          replacements: {
            agentId: agentId,
            date: date,
          },
        }
      );

      const windows: TimeWindow[] = [];

      for (const log of breakLunchLogs) {
        if (!log.startDateTime || !log.endDateTime) continue;

        const startTime = moment.tz(log.startDateTime, "Asia/Kolkata");
        const endTime = moment.tz(log.endDateTime, "Asia/Kolkata");

        // Clip to day boundaries
        const windowStart = startTime.isBefore(startOfDay)
          ? startOfDay.clone()
          : startTime;
        const windowEnd = endTime.isAfter(endOfDay)
          ? endOfDay.clone()
          : endTime;

        if (windowStart.isBefore(windowEnd) || windowStart.isSame(windowEnd)) {
          windows.push({ start: windowStart, end: windowEnd });
        }
      }

      // Merge overlapping windows (in case of multiple breaks/lunches)
      const mergedWindows = mergeTimeWindows(windows);

      return mergedWindows;
    } catch (error: any) {
      return [];
    }
  }

  /**
   * Get current break/lunch status for an agent
   * Checks if agent is currently on an ongoing break or lunch
   * Returns status code (1058 for Break, 1060 for Lunch) or null if not on break/lunch
   */
  async function getCurrentBreakLunchStatus(
    agentId: number,
    date: string
  ): Promise<number | null> {
    try {
      // Query userBreakLogs for ongoing breaks/lunches (endDateTime IS NULL)
      const ongoingBreakLunch: any[] = await sequelize.query(
        `SELECT userStatus, startDateTime 
         FROM \`rsa-crm-user\`.userBreakLogs 
         WHERE userId = :agentId 
           AND date = :date
           AND userStatus IN (1058, 1060)
           AND endDateTime IS NULL
         ORDER BY startDateTime DESC
         LIMIT 1`,
        {
          type: QueryTypes.SELECT,
          replacements: {
            agentId: agentId,
            date: date,
          },
        }
      );

      if (ongoingBreakLunch.length > 0 && ongoingBreakLunch[0].userStatus) {
        return ongoingBreakLunch[0].userStatus;
      }

      return null;
    } catch (error: any) {
      return null;
    }
  }

  /**
   * Exclude break/lunch intervals from working windows
   * Splits working windows at break/lunch boundaries and returns only non-break segments
   */
  function excludeBreakLunchFromWorkingWindows(
    workingWindows: TimeWindow[],
    breakLunchWindows: TimeWindow[]
  ): TimeWindow[] {
    if (breakLunchWindows.length === 0) {
      // No breaks/lunches to exclude, return working windows as-is
      return workingWindows;
    }

    const adjustedWindows: TimeWindow[] = [];

    for (const workingWindow of workingWindows) {
      // Find all break/lunch windows that overlap with this working window
      const overlappingBreaks = breakLunchWindows.filter((breakWindow) => {
        return (
          breakWindow.start.isBefore(workingWindow.end) &&
          breakWindow.end.isAfter(workingWindow.start)
        );
      });

      if (overlappingBreaks.length === 0) {
        // No breaks/lunches overlap with this working window, keep it as-is
        adjustedWindows.push(workingWindow);
        continue;
      }

      // Sort overlapping breaks by start time
      const sortedBreaks = [...overlappingBreaks].sort((a, b) =>
        a.start.diff(b.start, "milliseconds")
      );

      // Split working window at break/lunch boundaries
      let currentStart = workingWindow.start.clone();

      for (const breakWindow of sortedBreaks) {
        // If break starts after current start, keep segment before break
        if (breakWindow.start.isAfter(currentStart)) {
          const segmentEnd = moment.min(breakWindow.start, workingWindow.end);
          if (currentStart.isBefore(segmentEnd) || currentStart.isSame(segmentEnd)) {
            adjustedWindows.push({
              start: currentStart,
              end: segmentEnd,
            });
          }
        }

        // Move current start to after the break ends
        currentStart = moment.max(breakWindow.end, currentStart);
      }

      // Add remaining segment after last break (if any)
      if (currentStart.isBefore(workingWindow.end)) {
        adjustedWindows.push({
          start: currentStart,
          end: workingWindow.end,
        });
      }
    }

    // Merge any adjacent segments that might have been created
    return mergeTimeWindows(adjustedWindows);
  }

  /**
   * Get L1 active windows (case creation events)
   * Active window ends at MIN(submittedAt, clickedAt + 3 minutes)
   * - If submit in 2 mins: Active [9:58, 10:00] (2 mins), then Idle [10:00, next click]
   * - If submit in 5 mins: Active [9:58, 10:01] (3 mins max), then Idle [10:01, 10:05], then continue idle until next click
   */
  async function getL1ActiveWindows(
    agentId: number,
    date: string,
    workingWindows: TimeWindow[]
  ): Promise<TimeWindow[]> {
    try {
      const targetDate = moment.tz(date, "Asia/Kolkata");
      const startOfDay = targetDate.clone().startOf("day");
      const endOfDay = targetDate.clone().endOf("day");

      // Get all cases created by this agent on this date
      // Filter by both caseCreateClickedAt and createdAt to ensure we only count clicks that happened on the target date
      const l1Cases = await CaseDetails.findAll({
        where: {
          l1AgentId: agentId,
          caseCreateClickedAt: {
            [Op.ne]: null,
            [Op.between]: [startOfDay.format("YYYY-MM-DD HH:mm:ss"), endOfDay.format("YYYY-MM-DD HH:mm:ss")],
          },
          createdAt: {
            [Op.between]: [startOfDay.format("YYYY-MM-DD HH:mm:ss"), endOfDay.format("YYYY-MM-DD HH:mm:ss")],
          },
        },
        attributes: ["id", "createdAt", "caseCreateClickedAt"],
        order: [["createdAt", "ASC"]],
      });

      const activeWindows: TimeWindow[] = [];

      for (const caseItem of l1Cases) {
        const submittedAt = moment.tz(
          caseItem.dataValues.createdAt,
          "Asia/Kolkata"
        );
        const clickedAtRaw = caseItem.dataValues.caseCreateClickedAt;

        const clickedAt = moment.tz(clickedAtRaw, "Asia/Kolkata");

        // Active window ends at MIN(submittedAt, clickedAt + 3 minutes)
        // This ensures:
        // - If submit within 3 mins: active window ends at submit time
        // - If submit after 3 mins: active window is capped at 3 minutes from click
        const maxActiveEnd = clickedAt.clone().add(L1_ACTIVE_WINDOW_MINUTES, "minutes");
        const activeEnd = moment.min(submittedAt, maxActiveEnd);

        // Clip to day boundaries and working windows
        const clippedWindow = clipToWorkingWindows(
          { start: clickedAt, end: activeEnd },
          workingWindows,
          startOfDay,
          endOfDay
        );

        if (clippedWindow) {
          activeWindows.push(clippedWindow);
        }
      }

      const mergedWindows = mergeTimeWindows(activeWindows);

      return mergedWindows;
    } catch (error: any) {
      return [];
    }
  }

  /**
   * Get L2 active windows (service pick + ASP service accepted)
   * Active window ends at MIN(aspServiceAcceptedAt, pickedAt + 5 minutes)
   * - If accept in 3 mins: Active [10:00, 10:03] (3 mins), then Idle [10:03, next pick]
   * - If accept in 10 mins: Active [10:00, 10:05] (5 mins max), then Idle [10:05, 10:10], then continue idle until next pick
   * Note: One case can have multiple activities, so we query Activities directly
   */
  async function getL2ActiveWindows(
    agentId: number,
    date: string,
    workingWindows: TimeWindow[]
  ): Promise<TimeWindow[]> {
    try {
      const targetDate = moment.tz(date, "Asia/Kolkata");
      const startOfDay = targetDate.clone().startOf("day");
      const endOfDay = targetDate.clone().endOf("day");

      // Get cases assigned to this agent (current assignment)
      // Include agentReplacedAt to handle agent replacement
      const agentCases = await CaseDetails.findAll({
        where: {
          agentId: agentId,
        },
        attributes: ["id", "agentReplacedAt", "agentAssignedAt"],
      });

      const caseIds = agentCases.map((c: any) => c.id);

      if (caseIds.length === 0) {
        return [];
      }

      // Create a map of caseId -> agentReplacedAt for filtering activities
      const caseReplacementMap = new Map<number, moment.Moment | null>();
      for (const caseItem of agentCases) {
        const agentReplacedAtRaw = caseItem.dataValues.agentReplacedAt;
        if (agentReplacedAtRaw) {
          const agentReplacedAt = moment.tz(agentReplacedAtRaw, "Asia/Kolkata");
          if (agentReplacedAt.isValid()) {
            caseReplacementMap.set(caseItem.dataValues.id, agentReplacedAt);
          } else {
            caseReplacementMap.set(caseItem.dataValues.id, null);
          }
        } else {
          caseReplacementMap.set(caseItem.dataValues.id, null);
        }
      }

      // Get activities where agent is assigned, has picked service, and ASP service accepted
      // Note: One case can have multiple activities, so we query Activities directly
      const l2Activities = await Activities.findAll({
        where: {
          caseDetailId: {
            [Op.in]: caseIds,
          },
          agentPickedAt: {
            [Op.ne]: null,
            [Op.between]: [startOfDay.format("YYYY-MM-DD HH:mm:ss"), endOfDay.format("YYYY-MM-DD HH:mm:ss")],
          },
          aspServiceAcceptedAt: {
            [Op.ne]: null,
            [Op.between]: [startOfDay.format("YYYY-MM-DD HH:mm:ss"), endOfDay.format("YYYY-MM-DD HH:mm:ss")],
          },
        },
        attributes: ["id", "caseDetailId", "agentPickedAt", "aspServiceAcceptedAt"],
        order: [["aspServiceAcceptedAt", "ASC"]],
      });

      const activeWindows: TimeWindow[] = [];

      // console.log("l2Activities----------------")
      


      for (const activity of l2Activities) {
        const aspServiceAcceptedAtRaw = activity.dataValues.aspServiceAcceptedAt;
        const pickedAtRaw = activity.dataValues.agentPickedAt;
        const caseId = activity.dataValues.caseDetailId;

        const pickedAt = moment.tz(pickedAtRaw, "Asia/Kolkata");
        const aspServiceAcceptedAt = moment.tz(aspServiceAcceptedAtRaw, "Asia/Kolkata");

        if (!pickedAt.isValid() || !aspServiceAcceptedAt.isValid()) {
          continue;
        }

        // Handle agent replacement: compare replacement time with ASP acceptance time
        // (since we're querying cases where agentId = agentId, these are cases currently assigned to this agent)
        const agentReplacedAt = caseReplacementMap.get(caseId);
        if (agentReplacedAt && agentReplacedAt.isValid()) {
          // If replacement happened AFTER ASP acceptance, skip it (belongs to the old agent)
          if (agentReplacedAt.isAfter(aspServiceAcceptedAt) || agentReplacedAt.isSame(aspServiceAcceptedAt)) {
            continue; // Skip - this belongs to the old agent
          }
        }
        // console.log("pickedAt----------------")
        // console.log(pickedAt)
        // console.log("aspServiceAcceptedAt----------------")
        // console.log(aspServiceAcceptedAt)

        // Active window ends at MIN(aspServiceAcceptedAt, pickedAt + 5 minutes)
        // This ensures:
        // - If accept within 5 mins: active window ends at accept time
        // - If accept after 5 mins: active window is capped at 5 minutes from pick
        const maxActiveEnd = pickedAt.clone().add(L2_ACTIVE_WINDOW_MINUTES, "minutes");
        let activeEnd = moment.min(aspServiceAcceptedAt, maxActiveEnd);

        // Clip to day boundaries and working windows
        const clippedWindow = clipToWorkingWindows(
          { start: pickedAt, end: activeEnd },
          workingWindows,
          startOfDay,
          endOfDay
        );

        if (clippedWindow) {
          activeWindows.push(clippedWindow);
        }
      }

      return mergeTimeWindows(activeWindows);
    } catch (error: any) {
      return [];
    }
  }

  /**
   * Clip a time window to working windows and day boundaries
   * This ensures active time only counts when agent is logged in
   */
  function clipToWorkingWindows(
    window: TimeWindow,
    workingWindows: TimeWindow[],
    startOfDay: moment.Moment,
    endOfDay: moment.Moment
  ): TimeWindow | null {
    // First clip to day boundaries
    let clippedStart = window.start.isBefore(startOfDay)
      ? startOfDay.clone()
      : window.start;
    let clippedEnd = window.end.isAfter(endOfDay)
      ? endOfDay.clone()
      : window.end;

    if (clippedStart.isAfter(clippedEnd) || clippedStart.isSame(clippedEnd)) {
      return null;
    }

    // Check if window overlaps with any working window
    // This ensures we only count active time when agent is logged in
    for (const workingWindow of workingWindows) {
      const overlapStart = moment.max(clippedStart, workingWindow.start);
      const overlapEnd = moment.min(clippedEnd, workingWindow.end);

      if (overlapStart.isBefore(overlapEnd) || overlapStart.isSame(overlapEnd)) {
        return { start: overlapStart, end: overlapEnd };
      }
    }

    // Window doesn't overlap with any working window (agent not logged in during this time)
    return null;
  }

  /**
   * Merge overlapping time windows
   */
  function mergeTimeWindows(windows: TimeWindow[]): TimeWindow[] {
    if (windows.length === 0) return [];

    // Sort by start time
    const sorted = [...windows].sort((a, b) =>
      a.start.diff(b.start, "milliseconds")
    );

    const merged: TimeWindow[] = [];
    let current = sorted[0];

    for (let i = 1; i < sorted.length; i++) {
      const next = sorted[i];

      // If current window overlaps with next, merge them
      // Only merge if windows actually overlap (current.end >= next.start)
      // Do NOT merge if there's a gap between windows
      if (current.end.isSameOrAfter(next.start)) {
        current.end = moment.max(current.end, next.end);
      } else {
        merged.push(current);
        current = next;
      }
    }

    merged.push(current);
    return merged;
  }

  /**
   * Calculate total seconds in time windows
   * Uses milliseconds for precise calculation, then converts to seconds
   * This ensures accurate calculation and avoids rounding issues
   */
  function getTotalSeconds(windows: TimeWindow[]): number {
    return windows.reduce((total, window) => {
      // Calculate difference in milliseconds for precision, then convert to seconds
      const diffInMs = window.end.diff(window.start, "milliseconds");
      const diffInSeconds = Math.floor(diffInMs / 1000);
      return total + diffInSeconds;
    }, 0);
  }

  /**
   * Calculate active time and idle time for old agent (agent who was replaced)
   * This function calculates time for cases where previousAgentId = agentId and agentReplacedAt IS NOT NULL
   * Only calculates time for the period BEFORE replacement
   * 
   * @param agentId The agent ID (old agent who was replaced)
   * @param agentLevelId The agent level ID (1045=L1, 1046=L2, 1047=L1+L2)
   * @param date The date to calculate for (YYYY-MM-DD)
   * @param workingWindows The working windows for the agent on this date
   * @returns Object with activeTime and idleTime in seconds
   */
  async function calculateOldAgentTime(
    agentId: number,
    agentLevelId: number,
    date: string,
    workingWindows: TimeWindow[]
  ): Promise<{ activeTime: number; idleTime: number }> {
    try {
      const targetDate = moment.tz(date, "Asia/Kolkata");
      const startOfDay = targetDate.clone().startOf("day");
      const endOfDay = targetDate.clone().endOf("day");

      // Query cases where this agent was replaced (previous = agentId) and replacement happened on this date
      const replacedCases = await CaseDetails.findAll({
        where: {
          previousAgentId: agentId,
          agentReplacedAt: {
            [Op.ne]: null,
            [Op.between]: [startOfDay.format("YYYY-MM-DD HH:mm:ss"), endOfDay.format("YYYY-MM-DD HH:mm:ss")],
          },
        },
        attributes: ["id", "agentReplacedAt"],
      });

      if (replacedCases.length === 0) {
        return { activeTime: 0, idleTime: 0 };
      }

      // For L2 or L1+L2 agents, calculate active windows for activities before replacement
      const caseIds = replacedCases.map((c: any) => c.id);
      
      // Create a map of caseId -> agentReplacedAt for filtering activities
      const caseReplacementMap = new Map<number, moment.Moment>();
      for (const caseItem of replacedCases) {
        const agentReplacedAtRaw = caseItem.dataValues.agentReplacedAt;
        if (agentReplacedAtRaw) {
          const agentReplacedAt = moment.tz(agentReplacedAtRaw, "Asia/Kolkata");
          if (agentReplacedAt.isValid()) {
            caseReplacementMap.set(caseItem.dataValues.id, agentReplacedAt);
          }
        }
      }

      // Get activities where agent picked service and ASP service accepted
      // Only count activities that occurred BEFORE replacement
      const l2Activities = await Activities.findAll({
        where: {
          caseDetailId: {
            [Op.in]: caseIds,
          },
          agentPickedAt: {
            [Op.ne]: null,
            [Op.between]: [startOfDay.format("YYYY-MM-DD HH:mm:ss"), endOfDay.format("YYYY-MM-DD HH:mm:ss")],
          },
          aspServiceAcceptedAt: {
            [Op.ne]: null,
            [Op.between]: [startOfDay.format("YYYY-MM-DD HH:mm:ss"), endOfDay.format("YYYY-MM-DD HH:mm:ss")],
          },
        },
        attributes: ["id", "caseDetailId", "agentPickedAt", "aspServiceAcceptedAt"],
        order: [["aspServiceAcceptedAt", "ASC"]],
      });

      const activeWindows: TimeWindow[] = [];

      for (const activity of l2Activities) {
        const aspServiceAcceptedAtRaw = activity.dataValues.aspServiceAcceptedAt;
        const pickedAtRaw = activity.dataValues.agentPickedAt;
        const caseId = activity.dataValues.caseDetailId;

        const pickedAt = moment.tz(pickedAtRaw, "Asia/Kolkata");
        const aspServiceAcceptedAt = moment.tz(aspServiceAcceptedAtRaw, "Asia/Kolkata");

        if (!pickedAt.isValid() || !aspServiceAcceptedAt.isValid()) {
          continue;
        }

        // Get replacement time for this case
        const agentReplacedAt = caseReplacementMap.get(caseId);
        if (!agentReplacedAt || !agentReplacedAt.isValid()) {
          continue;
        }

        // If replacement happened before acceptance
        if (agentReplacedAt.isBefore(aspServiceAcceptedAt) || agentReplacedAt.isSame(aspServiceAcceptedAt)) {
          continue; // Skip - this belongs to the new agent
        }

        // console.log("old agentpickedAt----------------")
        // console.log(pickedAt)
        // console.log("old agent aspServiceAcceptedAt----------------")
        // console.log(aspServiceAcceptedAt)
        

        // Old agent gets full active window (replacement happened after acceptance)
        const maxActiveEnd = pickedAt.clone().add(L2_ACTIVE_WINDOW_MINUTES, "minutes");
        const activeEnd = moment.min(aspServiceAcceptedAt, maxActiveEnd);

        // Clip to day boundaries and working windows
        const clippedWindow = clipToWorkingWindows(
          { start: pickedAt, end: activeEnd },
          workingWindows,
          startOfDay,
          endOfDay
        );

        if (clippedWindow) {
          activeWindows.push(clippedWindow);
        }
      }

      const mergedWindows = mergeTimeWindows(activeWindows);

      // console.log("old agent activeWindows----------------")
      // console.log(activeWindows)

      // console.log("old agent mergedWindows----------------")
      // console.log(mergedWindows)


      const activeTime = getTotalSeconds(mergedWindows);

      // Calculate idle time: working time minus active time (only for period before replacement)
      // We need to clip working windows to end at replacement time for each case
      // For simplicity, we'll calculate idle time based on the active time we found
      // The idle time is the working time minus active time, but only for the period before replacement
      // Since we're calculating for multiple cases with different replacement times, we'll use a simplified approach:
      // idleTime = activeTime (this is approximate, but the main goal is to track active time correctly)
      // Actually, we should calculate idle time properly by considering working windows clipped to replacement time
      
      // For now, we'll return activeTime and let the caller handle idle time calculation
      // The idle time will be recalculated in the main function using the updated active time
      const idleTime = 0; // Will be recalculated in the main function


      // console.log("old agent activeTime-----------")
      // console.log(activeTime)

      
      return { activeTime, idleTime };
    } catch (error: any) {
      return { activeTime: 0, idleTime: 0 };
    }
  }

  /**
   * Calculates total active time (sum of all active windows) in seconds
   * Used for L1, L2, and L1+L2 agents
   * 
   * @param workingWindows Optional: If provided, uses these windows instead of fetching again
   *                       This ensures consistency when called with recalculateIdleTime
   */
  export async function calculateActiveTime(
    agentId: number,
    agentLevelId: number,
    date: string,
    workingWindows?: TimeWindow[]
  ): Promise<number> {
    try {
      // Get working windows (login-logout intervals) if not provided
      if (!workingWindows) {
        workingWindows = await getWorkingWindows(agentId, date);
      }

      if (workingWindows.length === 0) {
        // No login = no active time
        return 0;
      }

      // Get active windows based on agent level
      let activeWindows: TimeWindow[] = [];

      if (agentLevelId == 1045) {
        // L1 only: get L1 active windows
        activeWindows = await getL1ActiveWindows(
          agentId,
          date,
          workingWindows
        );
      } else if (agentLevelId == 1046) {
        // L2 only: get L2 active windows
        activeWindows = await getL2ActiveWindows(
          agentId,
          date,
          workingWindows
        );
      } else if (agentLevelId == 1047) {
        // L1+L2: get both and merge
        const l1Windows = await getL1ActiveWindows(
          agentId,
          date,
          workingWindows
        );
        const l2Windows = await getL2ActiveWindows(
          agentId,
          date,
          workingWindows
        );
        activeWindows = mergeTimeWindows([...l1Windows, ...l2Windows]);
      }

      const totalActiveSeconds = getTotalSeconds(activeWindows);
      return totalActiveSeconds;
    } catch (error: any) {
      return 0;
    }
  }

  /**
   * Calculate real-time current working status for an agent
   * Based on latest L1 and L2 events
   * Returns "Absent" if agent not logged in
   * 
   * L1 Logic:
   * - Check "Create Case" click time from both submitted cases (caseDetails.caseCreateClickedAt) 
   *   and non-submitted cases (tempCaseFormDetails.createdAt)
   * - Show "Active" if within 3 mins, "Idle" if crossed 3 mins
   * - If case was submitted within 3 mins, show "Idle" immediately after submission
   * 
   * L2 Logic:
   * - Check "Picked Service" time (agentPickedAt) even if ASP hasn't accepted
   * - Show "Active" if within 5 mins, "Idle" if crossed 5 mins
   * - If ASP accepted within 5 mins, show "Idle" immediately after acceptance
   * 
   * L1+L2 Logic:
   * - Apply both logics - if either is "Active", status is "Active", otherwise "Idle"
   */
  async function calculateRealTimeStatus(
    agentId: number,
    agentLevelId: number,
    date: string
  ): Promise<string> {
    try {
      const now = moment.tz("Asia/Kolkata");
      const targetDate = moment.tz(date, "Asia/Kolkata");
      const startOfDay = targetDate.clone().startOf("day");
      const endOfDay = targetDate.clone().endOf("day");

      // Check if agent is currently within a working window (logged in)
      const workingWindows = await getWorkingWindows(agentId, date);

      // If no working windows, agent is absent
      if (workingWindows.length === 0) {
        return "Absent";
      }

      const isCurrentlyWorking = workingWindows.some(
        (window) => now.isBetween(window.start, window.end, null, "[]")
      );

      if (!isCurrentlyWorking) {
        return "Idle";
      }

      // Check if agent is currently on break or lunch
      const currentBreakLunchStatus = await getCurrentBreakLunchStatus(agentId, date);
      if (currentBreakLunchStatus === 1058) {
        return "Break";
      }
      if (currentBreakLunchStatus === 1060) {
        return "Meal Break";
      }

      let l1Status: string = "Idle";
      let l2Status: string = "Idle";

      // Get L1 status if agent is L1 or L1+L2
      if (
        agentLevelId == 1045 ||
        agentLevelId == 1047
      ) {

        const caseDetailWhere: any = {
          caseCreateClickedAt: {
            [Op.ne]: null,
            [Op.between]: [startOfDay.format("YYYY-MM-DD HH:mm:ss"), endOfDay.format("YYYY-MM-DD HH:mm:ss")]
          },
          createdAt: {
            [Op.between]: [startOfDay.format("YYYY-MM-DD HH:mm:ss"), endOfDay.format("YYYY-MM-DD HH:mm:ss")],
          },
        };
        if(agentLevelId == 1045) {
          //L1 AGENT
          caseDetailWhere.l1AgentId = agentId;
        } else{
          //L1 & L2 AGENT
          caseDetailWhere[Op.or] = [{ l1AgentId: agentId }, { agentId: agentId }];
        }


        // Query caseDetails for latest caseCreateClickedAt (submitted cases)
        const latestSubmittedCase = await CaseDetails.findOne({
          where: caseDetailWhere,
          attributes: ["createdAt", "caseCreateClickedAt"],
          order: [["caseCreateClickedAt", "DESC"]],
        });

        // Query tempCaseFormDetails for latest createdAt (non-submitted cases)
        // Use raw query to parse JSON from payload
        const latestTempCase: any[] = await sequelize.query(
          `SELECT createdAt 
           FROM tempCaseFormDetails 
           WHERE JSON_EXTRACT(payload, '$.createdById') = :agentId
             AND createdAt >= :startOfDay 
             AND createdAt <= :endOfDay
             AND deletedAt IS NULL
           ORDER BY createdAt DESC
           LIMIT 1`,
          {
            type: QueryTypes.SELECT,
            replacements: {
              agentId: agentId,
              startOfDay: startOfDay.format("YYYY-MM-DD HH:mm:ss"),
              endOfDay: endOfDay.format("YYYY-MM-DD HH:mm:ss"),
            },
          }
        );

        let latestClickTime: moment.Moment | null = null;
        let submittedAt: moment.Moment | null = null;

        // Get latest click time from submitted cases
        if (latestSubmittedCase && latestSubmittedCase.dataValues.caseCreateClickedAt) {
          const clickedAt = moment.tz(
            latestSubmittedCase.dataValues.caseCreateClickedAt,
            "Asia/Kolkata"
          );
          if (!latestClickTime || clickedAt.isAfter(latestClickTime)) {
            latestClickTime = clickedAt;
            submittedAt = moment.tz(
              latestSubmittedCase.dataValues.createdAt,
              "Asia/Kolkata"
            );
          }
        }

        // Get latest click time from non-submitted cases
        if (latestTempCase.length > 0 && latestTempCase[0].createdAt) {
          const tempClickedAt = moment.tz(
            latestTempCase[0].createdAt,
            "Asia/Kolkata"
          );
          if (!latestClickTime || tempClickedAt.isAfter(latestClickTime)) {
            latestClickTime = tempClickedAt;
            submittedAt = null; // Not submitted yet
          }
        }

        // Determine L1 status based on latest click time
        if (latestClickTime) {
          const minutesSinceClick = now.diff(latestClickTime, "minutes", true);

          if (minutesSinceClick <= L1_ACTIVE_WINDOW_MINUTES) {
            // Within 3 mins window
            if (submittedAt) {
              // Case was submitted - check if it was submitted within 3 mins
              const minutesToSubmit = submittedAt.diff(latestClickTime, "minutes", true);
              if (minutesToSubmit <= L1_ACTIVE_WINDOW_MINUTES) {
                // Submitted within 3 mins - check if now is after submission
                if (now.isAfter(submittedAt)) {
                  // Submitted within 3 mins and now is after submission → Idle
                  l1Status = "Idle";
                } else {
                  // Submitted within 3 mins but now is before submission (shouldn't happen, but handle it)
                  l1Status = "Active";
                }
              } else {
                // Submitted after 3 mins - but we're still within 3 mins from click, so Active
                l1Status = "Active";
              }
            } else {
              // Not submitted yet, within 3 mins → Active
              l1Status = "Active";
            }
          } else {
            // Crossed 3 mins → Idle
            l1Status = "Idle";
          }
        } else {
          // No click found → Idle
          l1Status = "Idle";
        }
      }

      // Get L2 status if agent is L2 or L1+L2
      if (
        agentLevelId == 1046 ||
        agentLevelId == 1047
      ) {

        const caseDetailWhere: any = {};
        if(agentLevelId == 1046) {
          //L2 AGENT
          caseDetailWhere.agentId = agentId;
        } else{
          //L1 & L2 AGENT
          caseDetailWhere[Op.or] = [{ l1AgentId: agentId }, { agentId: agentId }];
        }

        // Get case IDs assigned to this agent (include agentReplacedAt for replacement logic)
        const agentCases = await CaseDetails.findAll({
          where: caseDetailWhere,
          attributes: ["id", "agentReplacedAt"],
        });

        const caseIds = agentCases.map((c: any) => c.id);

        // Create a map of caseId -> agentReplacedAt for filtering activities
        const caseReplacementMap = new Map<number, moment.Moment | null>();
        for (const caseItem of agentCases) {
          const agentReplacedAtRaw = caseItem.dataValues.agentReplacedAt;
          if (agentReplacedAtRaw) {
            const agentReplacedAt = moment.tz(agentReplacedAtRaw, "Asia/Kolkata");
            if (agentReplacedAt.isValid()) {
              caseReplacementMap.set(caseItem.dataValues.id, agentReplacedAt);
            } else {
              caseReplacementMap.set(caseItem.dataValues.id, null);
            }
          } else {
            caseReplacementMap.set(caseItem.dataValues.id, null);
          }
        }

        if (caseIds.length > 0) {
          // Get all activities where agent picked service (even if ASP hasn't accepted)
          // We need to get all activities first, then filter by replacement logic
          const allL2Activities = await Activities.findAll({
            where: {
              caseDetailId: {
                [Op.in]: caseIds,
              },
              agentPickedAt: {
                [Op.ne]: null,
                [Op.between]: [startOfDay.format("YYYY-MM-DD HH:mm:ss"), endOfDay.format("YYYY-MM-DD HH:mm:ss")],
              },
            },
            attributes: ["id", "caseDetailId", "agentPickedAt", "aspServiceAcceptedAt"],
            order: [["agentPickedAt", "DESC"]],
          });

          // Filter activities based on agent replacement logic
          // If replacement happened AFTER ASP acceptance → old agent should see it
          // If replacement happened BEFORE ASP acceptance → new agent should see it
          let latestL2Activity: any = null;
          for (const activity of allL2Activities) {
            const caseId = activity.dataValues.caseDetailId;
            const agentReplacedAt = caseReplacementMap.get(caseId);
            const aspServiceAcceptedAtRaw = activity.dataValues.aspServiceAcceptedAt;

            // If no replacement, include the activity
            if (!agentReplacedAt || !agentReplacedAt.isValid()) {
              latestL2Activity = activity;
              break;
            }

            // If replacement exists, check if activity belongs to current agent
            if (aspServiceAcceptedAtRaw) {
              const aspServiceAcceptedAt = moment.tz(aspServiceAcceptedAtRaw, "Asia/Kolkata");
              if (aspServiceAcceptedAt.isValid()) {
                // If replacement happened AFTER ASP acceptance, skip (belongs to old agent)
                // If replacement happened BEFORE ASP acceptance, include (belongs to new agent)
                if (agentReplacedAt.isAfter(aspServiceAcceptedAt) || agentReplacedAt.isSame(aspServiceAcceptedAt)) {
                  continue; // Skip - this belongs to the old agent
                } else {
                  // Replacement happened before acceptance - new agent gets it
                  latestL2Activity = activity;
                  break;
                }
              } else {
                // ASP acceptance time invalid, include the activity
                latestL2Activity = activity;
                break;
              }
            } else {
              // No ASP acceptance yet, include the activity (new agent gets it if replacement happened)
              latestL2Activity = activity;
              break;
            }
          }

          if (latestL2Activity && latestL2Activity.dataValues.agentPickedAt) {
            const pickedAt = moment.tz(
              latestL2Activity.dataValues.agentPickedAt,
              "Asia/Kolkata"
            );
            const aspServiceAcceptedAtRaw = latestL2Activity.dataValues.aspServiceAcceptedAt;
            const aspServiceAcceptedAt = aspServiceAcceptedAtRaw
              ? moment.tz(aspServiceAcceptedAtRaw, "Asia/Kolkata")
              : null;

            if (pickedAt.isValid()) {
              const minutesSincePick = now.diff(pickedAt, "minutes", true);

              if (minutesSincePick <= L2_ACTIVE_WINDOW_MINUTES) {
                // Within 5 mins window
                if (aspServiceAcceptedAt && aspServiceAcceptedAt.isValid()) {
                  // ASP accepted - check if it was accepted within 5 mins
                  const minutesToAccept = aspServiceAcceptedAt.diff(pickedAt, "minutes", true);
                  if (minutesToAccept <= L2_ACTIVE_WINDOW_MINUTES) {
                    // Accepted within 5 mins - check if now is after acceptance
                    if (now.isAfter(aspServiceAcceptedAt)) {
                      // Accepted within 5 mins and now is after acceptance → Idle
                      l2Status = "Idle";
                    } else {
                      // Accepted within 5 mins but now is before acceptance (shouldn't happen, but handle it)
                      l2Status = "Active";
                    }
                  } else {
                    // Accepted after 5 mins - but we're still within 5 mins from pick, so Active
                    l2Status = "Active";
                  }
                } else {
                  // ASP hasn't accepted yet, within 5 mins → Active
                  l2Status = "Active";
                }
              } else {
                // Crossed 5 mins → Idle
                l2Status = "Idle";
              }
            } else {
              l2Status = "Idle";
            }
          } else {
            l2Status = "Idle";
          }
        } else {
          l2Status = "Idle";
        }
      }

      // For L1+L2 agents: if either is "Active", return "Active", otherwise "Idle"
      if (agentLevelId == 1047) {
        return l1Status === "Active" || l2Status === "Active" ? "Active" : "Idle";
      } else if (agentLevelId == 1045) {
        return l1Status;
      } else if (agentLevelId == 1046) {
        return l2Status;
      }

      return "Idle";
    } catch (error: any) {
      return "Idle";
    }
  }

  /**
   * Recalculates idle time for a specific agent and date (in seconds)
   * Uses working windows (login/logout) and active windows (L1/L2 events)
   * Returns null if agent not logged in (absent)
   * 
   * @param workingWindows Optional: If provided, uses these windows instead of fetching again
   *                       This ensures consistency when called with calculateActiveTime
   * @param additionalActiveTime Optional: Additional active time to add (e.g., from old agent cases)
   */
  export async function recalculateIdleTime(
    agentId: number,
    agentLevelId: number,
    date: string,
    workingWindows?: TimeWindow[],
    additionalActiveTime: number = 0
  ): Promise<number | null> {
    try {
      // Get working windows (login-logout intervals) if not provided
      if (!workingWindows) {
        workingWindows = await getWorkingWindows(agentId, date);
      }

      if (workingWindows.length === 0) {
        // No login = agent absent = null idle time
        return null;
      }

      const totalWorkingSeconds = getTotalSeconds(workingWindows);

      // Get active windows based on agent level
      let activeWindows: TimeWindow[] = [];

      if (agentLevelId == 1045) {
        // L1 only: get L1 active windows
        activeWindows = await getL1ActiveWindows(
          agentId,
          date,
          workingWindows
        );
      } else if (agentLevelId == 1046) {
        // L2 only: get L2 active windows
        activeWindows = await getL2ActiveWindows(
          agentId,
          date,
          workingWindows
        );
      } else if (agentLevelId == 1047) {
        // L1+L2: get both and merge
        const l1Windows = await getL1ActiveWindows(
          agentId,
          date,
          workingWindows
        );
        const l2Windows = await getL2ActiveWindows(
          agentId,
          date,
          workingWindows
        );

        activeWindows = mergeTimeWindows([...l1Windows, ...l2Windows]);
      }

      const totalActiveSeconds = getTotalSeconds(activeWindows) + additionalActiveTime;

      const totalIdleSeconds = Math.max(0, totalWorkingSeconds - totalActiveSeconds);

      // console.log("totalWorkingSeconds-----------")
      // console.log(totalWorkingSeconds)

      // console.log("activeWindows-----------")
      // console.log(activeWindows)
      // console.log("additionalActiveTime-----------")
      // console.log(additionalActiveTime)
      // console.log("totalActiveSeconds-----------")
      // console.log(totalActiveSeconds)
      // console.log("totalIdleSeconds-----------")
      // console.log(totalIdleSeconds)

      // Return idle time in seconds
      return totalIdleSeconds;
    } catch (error: any) {
      return null;
    }
  }

  /**
   * Updates productivity for all agents (called by cron scheduler every minute)
   * Processes agents in batches to avoid overwhelming the system
   */
  export async function updateAllAgentsProductivity(
    req: Request,
    res: Response
  ) {
    try {
      const today = moment.tz("Asia/Kolkata").format("YYYY-MM-DD");

      // Get all agents (roleId = 3) from User service
      const apiParams: any = {};
      apiParams.where = {
        roleId: 3,
      };
      const agentDetails = await axios.post(
        `${userServiceUrl}/${userServiceEndpoint.getAgentsByRole}`,
        apiParams
      );

      if (!agentDetails.data.success) {
        return res.status(200).json({
          success: false,
          error: "Failed to fetch agents",
        });
      }

      const agents = agentDetails.data.data || [];
      const results = {
        total: agents.length,
        success: 0,
        errors: 0,
        errorDetails: [] as any[],
      };

      // Process agents in smaller batches to avoid overwhelming database connections
      const batchSize = 3;

      for (let i = 0; i < agents.length; i += batchSize) {
        const batch = agents.slice(i, i + batchSize);

        // Process batch in parallel
        await Promise.all(
          batch.map(async (agent: any) => {
            try {
              // Get agent levelId directly from agent object (included in getAgentsByRole response)
              const agentLevelId = agent.levelId || 1045;

              // Use transaction for consistency with updateAgentProductivity
              const transaction = await sequelize.transaction();

              try {
                // Find or create productivity log for today
                let productivityLog: any = await AgentProductivityLogs.findOne({
                  where: {
                    agentId: agent.id,
                    date: today,
                  },
                  transaction,
                });

                // Get most recent login datetime from userLogs for current date
                let loginDatetime = null;
                const userLogs: any[] = await sequelize.query(
                  `SELECT loginDateTime 
                    FROM \`rsa-crm-user\`.userLogs 
                    WHERE userId = :agentId 
                      AND deletedAt IS NULL
                      AND loginDateTime >= :startOfDay
                      AND loginDateTime < DATE_ADD(:startOfDay, INTERVAL 1 DAY)
                    ORDER BY loginDateTime DESC
                    LIMIT 1`,
                  {
                    type: QueryTypes.SELECT,
                    replacements: {
                      agentId: agent.id,
                      startOfDay: moment.tz(today, "Asia/Kolkata").startOf("day").format("YYYY-MM-DD HH:mm:ss"),
                    },
                    transaction,
                  }
                );

                if (userLogs.length > 0 && userLogs[0].loginDateTime) {
                  loginDatetime = userLogs[0].loginDateTime;
                }

                // Store current values for comparison (before calculations)
                let currentValues: any = null;
                if (productivityLog) {
                  currentValues = {
                    loginDatetime: productivityLog.loginDatetime,
                    activeTime: productivityLog.activeTime,
                    currentWorkingStatus: productivityLog.currentWorkingStatus,
                    assigned: productivityLog.assigned,
                    notPicked: productivityLog.notPicked,
                    picked: productivityLog.picked,
                    inprogress: productivityLog.inprogress,
                    cancelled: productivityLog.cancelled,
                    completed: productivityLog.completed,
                    // lastCaseAllocatedDateTime: productivityLog.lastCaseAllocatedDateTime,
                    idleTime: productivityLog.idleTime,
                  };
                }

                if (!productivityLog) {
                  // Create initial entry if it doesn't exist
                  productivityLog = await AgentProductivityLogs.create(
                    {
                      agentId: agent.id,
                      date: today,
                      loginDatetime: loginDatetime,
                      currentWorkingStatus: "Idle",
                      assigned: 0,
                      notPicked: 0,
                      picked: 0,
                      inprogress: 0,
                      cancelled: 0,
                      completed: 0,
                      // lastCaseAllocatedDateTime: null,
                      activeTime: "0",
                      idleTime: null,
                    },
                    { transaction }
                  );
                }

                // Recalculate all counts from caseDetails (assigned cases)
                const startOfDay = moment.tz(today, "Asia/Kolkata").startOf("day");
                const endOfDay = moment.tz(today, "Asia/Kolkata").endOf("day");

                // Get detailed case list for accurate counts (assigned cases)
                // For agent replacement: only count cases currently assigned to agent
                // Exclude cases that were replaced from this agent (agentReplacedAt exists means case was replaced FROM this agent)
                const caseDetailWhere: any = {
                  agentAssignedAt: {
                    [Op.between]: [startOfDay.format("YYYY-MM-DD HH:mm:ss"), endOfDay.format("YYYY-MM-DD HH:mm:ss")],
                  },
                  // statusId: {
                  //   [Op.ne]: 3, // 3 - Cancelled
                  // },
                };
                if (agentLevelId == 1045) {
                  //L1 AGENT
                  caseDetailWhere.l1AgentId = agent.id;
                } else if (agentLevelId == 1046) {
                  //L2 AGENT
                  caseDetailWhere.agentId = agent.id;
                } else if (agentLevelId == 1047) {
                  //L1 & L2 AGENT
                  caseDetailWhere[Op.or] = [{ l1AgentId: agent.id }, { agentId: agent.id }];
                }

                const allCases: any = await CaseDetails.findAll({
                  where: caseDetailWhere,
                  attributes: ["id", "statusId", "agentAssignedAt", "agentReplacedAt", "agentId", "l1AgentId"],
                  order: [["agentAssignedAt", "DESC"]],
                  transaction,
                });

                const caseIds = allCases.map((c: any) => c.id);

                // Get all activities for these cases to check if agent picked any and if ASP accepted any
                // Positive flow: Exclude Cancelled (4) and Rejected (8)
                const caseHasAgentPicked = new Map<number, boolean>();
                const caseHasAspAccepted = new Map<number, boolean>();
                
                if (caseIds.length > 0) {
                  // Get all activities where agent picked any service
                  const pickedActivities = await Activities.findAll({
                    where: {
                      caseDetailId: {
                        [Op.in]: caseIds,
                      },
                      agentPickedAt: {
                        [Op.ne]: null,
                      },
                      activityStatusId: {
                        [Op.notIn]: [4, 8], // Exclude Cancelled (4) and Rejected (8)
                      },
                    },
                    attributes: ["id", "caseDetailId"],
                    transaction,
                  });

                  // Mark cases where agent picked any service
                  for (const activity of pickedActivities) {
                    const caseId = activity.dataValues.caseDetailId;
                    caseHasAgentPicked.set(caseId, true);
                  }

                  // Get all activities where ASP accepted any service (could be different from picked)
                  const aspAcceptedActivities = await Activities.findAll({
                    where: {
                      caseDetailId: {
                        [Op.in]: caseIds,
                      },
                      aspServiceAcceptedAt: {
                        [Op.ne]: null,
                      },
                      activityStatusId: {
                        [Op.notIn]: [4, 8], // Exclude Cancelled (4) and Rejected (8)
                      },
                    },
                    attributes: ["id", "caseDetailId"],
                    transaction,
                  });

                  // Mark cases where ASP accepted any service
                  for (const activity of aspAcceptedActivities) {
                    const caseId = activity.dataValues.caseDetailId;
                    caseHasAspAccepted.set(caseId, true);
                  }
                }

                // Calculate counts based on new logic:
                // - assigned: Count all cases assigned to agent (regardless of status)
                // - notPicked: Agent assigned but NO activity has agentPickedAt
                // - picked: Agent picked any service AND case does NOT have ANY ASP accepted service
                // - inprogress: Agent picked any service AND at least one service (could be different) has ASP accepted, and case not cancelled (3) and not closed (4)
                // - cancelled: Case cancelled (statusId = 3)
                // - completed: Case closed (statusId = 4)
                let assigned = 0;
                let notPicked = 0;
                let picked = 0;
                let inprogress = 0;
                let cancelled = 0;
                let completed = 0;

                for (const caseItem of allCases) {
                  const caseId = caseItem.dataValues.id;
                  const statusId = caseItem.dataValues.statusId;
                  const hasAgentPicked = caseHasAgentPicked.get(caseId) || false;
                  const hasAspAccepted = caseHasAspAccepted.get(caseId) || false;

                  // assigned: count all cases
                  assigned++;

                  if (statusId == 3) {
                    // Case cancelled
                    cancelled++;
                  } else if (statusId == 4) {
                    // Case closed (Completed)
                    completed++;
                  } else {
                    // Case is not cancelled and not closed
                    if (hasAgentPicked && hasAspAccepted) {
                      // Agent picked any service AND ASP accepted any service (could be different)
                      inprogress++;
                    } else if (hasAgentPicked && !hasAspAccepted) {
                      // Agent picked any service AND case does NOT have ANY ASP accepted service
                      picked++;
                    } else {
                      // Agent assigned but no activity picked
                      notPicked++;
                    }
                  }
                }

                // Get last case allocated datetime (latest assignment)
                // const lastCase = allCases.length > 0 ? allCases[0] : null;
                // let lastCaseAllocatedDateTime = lastCase
                //   ? lastCase.agentAssignedAt
                //   : null;

                // OPTIMIZATION: Skip calculation if agent hasn't logged in today (will be "Absent")
                // Get working windows first - if empty, agent is absent, skip expensive calculations
                const workingWindows = await getWorkingWindows(agent.id, today);

                let activeTime = 0;
                let idleTime: number | null = null;
                let currentWorkingStatus = "Absent";

                // Only calculate if agent has logged in (has working windows)
                if (workingWindows.length > 0) {
                  // Calculate active time (total seconds) - pass working windows for consistency
                  activeTime = await calculateActiveTime(
                    agent.id,
                    agentLevelId,
                    today,
                    workingWindows
                  );

                  // Calculate old agent's active time (for cases where this agent was replaced)
                  // Only applies to L2 agents (L1 agents are never replaced)
                  let oldAgentActiveTime = 0;
                  if (agentLevelId === 1046 || agentLevelId === 1047) {
                    const oldAgentTime = await calculateOldAgentTime(
                      agent.id,
                      agentLevelId,
                      today,
                      workingWindows
                    );
                    oldAgentActiveTime = oldAgentTime.activeTime;
                    // Add old agent's active time to total
                    activeTime += oldAgentActiveTime;
                  }

                  // Recalculate idle time using new logic (in seconds) - use same working windows
                  // Pass additional active time from old agent cases so idle time is calculated correctly
                  idleTime = await recalculateIdleTime(
                    agent.id,
                    agentLevelId,
                    today,
                    workingWindows,
                    oldAgentActiveTime
                  );

                  // Calculate real-time status
                  currentWorkingStatus = await calculateRealTimeStatus(
                    agent.id,
                    agentLevelId,
                    today
                  );
                }
                // Prepare new values for comparison
                const newActiveTime = String(activeTime);
                const newIdleTime = idleTime !== null ? String(idleTime) : null;

                // Check if any values have changed
                let hasChanges = false;
                if (!currentValues) {
                  // New record was created, so we need to sync
                  hasChanges = true;
                } else {
                  // Helper function to compare dates (handles both Date objects and strings)
                  const compareDates = (date1: any, date2: any): boolean => {
                    if (date1 === null && date2 === null) return true;
                    if (date1 === null || date2 === null) return false;
                    const time1 = date1 instanceof Date ? date1.getTime() : new Date(date1).getTime();
                    const time2 = date2 instanceof Date ? date2.getTime() : new Date(date2).getTime();
                    return time1 === time2;
                  };

                  // Compare each field to detect changes
                  if (
                    !compareDates(currentValues.loginDatetime, loginDatetime) ||
                    currentValues.assigned !== assigned ||
                    currentValues.notPicked !== notPicked ||
                    currentValues.picked !== picked ||
                    currentValues.inprogress !== inprogress ||
                    currentValues.cancelled !== cancelled ||
                    currentValues.completed !== completed ||
                    // !compareDates(currentValues.lastCaseAllocatedDateTime, lastCaseAllocatedDateTime) ||
                    currentValues.currentWorkingStatus !== currentWorkingStatus ||
                    currentValues.activeTime !== newActiveTime ||
                    currentValues.idleTime !== newIdleTime
                  ) {
                    hasChanges = true;
                  }
                }

                // Only update and sync if changes detected
                if (hasChanges) {
                  // Update productivity log (always update loginDatetime to most recent login for current date)
                  // Convert activeTime and idleTime to strings for TEXT column storage
                  await AgentProductivityLogs.update(
                    {
                      loginDatetime: loginDatetime,
                      assigned: assigned,
                      notPicked: notPicked,
                      picked: picked,
                      inprogress: inprogress,
                      cancelled: cancelled,
                      completed: completed,
                      // lastCaseAllocatedDateTime: lastCaseAllocatedDateTime,
                      currentWorkingStatus: currentWorkingStatus,
                      activeTime: newActiveTime,
                      idleTime: newIdleTime,
                    },
                    {
                      where: {
                        id: productivityLog.id,
                      },
                      transaction,
                    }
                  );
                  await transaction.commit();

                  // Sync report table only when changes occurred
                  Utils.createReportSyncTableRecord("agentProductivityReportDetails", [
                    productivityLog.id,
                  ]);
                } else {
                  await transaction.commit();
                }

                results.success++;
              } catch (error: any) {
                // Rollback transaction on error
                await transaction.rollback();

                results.errors++;
                results.errorDetails.push({
                  agentId: agent.id,
                  agentName: agent.name,
                  error: error?.message,
                });
              }
            } catch (error: any) {
              // Handle errors outside transaction (e.g., agent level fetch)
              results.errors++;
              results.errorDetails.push({
                agentId: agent.id,
                agentName: agent.name,
                error: error?.message,
              });
            }
          })
        );
      }

      return res.status(200).json({
        success: true,
        message: "Agent productivity updated successfully",
        data: {
          date: today,
          totalAgents: results.total,
          successCount: results.success,
          errorCount: results.errors,
          errorDetails: results.errorDetails,
        },
      });
    } catch (error: any) {
      console.error("Error in updateAllAgentsProductivity:", error);
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  /**
   * Gets agent productivity list for team leader or admin
   * - Team leader (roleId === 7): Shows productivity for agents under their team (tlId = userId)
   * - Admin (roleId === 1): Shows productivity for all agents
   */
  export async function getAgentProductivityList(
    req: Request,
    res: Response
  ) {
    try {
      const {
        startDate,
        endDate,
        limit,
        offset,
        userId,
        roleId,
        search,
      } = req.body;

      // Validate role - allow admin (1) or team leader (7)
      if (roleId !== 1 && roleId !== 7) {
        return res.status(200).json({
          success: false,
          error: "Access denied. Admin or Team leader role required.",
        });
      }

      // User ID required for team leader, not for admin
      if (roleId === 7 && !userId) {
        return res.status(200).json({
          success: false,
          error: "User ID is required for team leader",
        });
      }

      // Get agents based on role
      let agentDetails;
      if (roleId === 1) {
        // Admin: Get all agents
        agentDetails = await axios.post(
          `${userServiceUrl}/${userServiceEndpoint.getAgentsByRole}`,
          {
            roleId: 3, // Agent
          }
        );
      } else {
        // Team leader: Get agents where tlId = userId
        agentDetails = await axios.post(
          `${userServiceUrl}/${userServiceEndpoint.getAgentsByRole}`,
          {
            roleId: 3, // Agent
            where: {
              tlId: userId,
            },
          }
        );
      }

      if (!agentDetails.data.success) {
        return res.status(200).json({
          success: false,
          error: "Failed to fetch agents",
        });
      }

      let agents = agentDetails.data.data || [];

      // For search: filter agents by name if provided (for agent name search)
      // Keep all agents for agentMap to display names even if search doesn't match agent names
      let filteredAgentsForSearch = agents;
      if (search && search.trim()) {
        const searchLower = search.toLowerCase().trim();
        filteredAgentsForSearch = agents.filter((agent: any) =>
          agent.name && agent.name.toLowerCase().includes(searchLower)
        );
      }

      const agentIds = filteredAgentsForSearch.map((agent: any) => agent.id);

      // Set date range defaults
      const startDateValue = startDate;
      const endDateValue = endDate;

      // Set pagination defaults
      let limitValue: number = defaultLimit;
      if (limit) {
        const parsedLimit = parseInt(limit as string);
        if (!isNaN(parsedLimit) && Number.isInteger(parsedLimit)) {
          limitValue = parsedLimit;
        }
      }

      let offsetValue: number = defaultOffset;
      if (offset) {
        const parsedOffset = parseInt(offset as string);
        if (!isNaN(parsedOffset) && Number.isInteger(parsedOffset)) {
          offsetValue = parsedOffset;
        }
      }

      // Build where clause for productivity logs
      let whereClause: any = {};
      if (startDateValue && endDateValue) {
        whereClause.date = {
          [Op.between]: [startDateValue, endDateValue],
        };
      }

      // Build search conditions using Op.or pattern (similar to nearestCity.ts)
      if (search && search.trim()) {
        const searchConditions: any[] = [];

        // Search by agent IDs (if agents matched by name)
        if (agentIds.length > 0) {
          searchConditions.push({
            agentId: {
              [Op.in]: agentIds,
            },
          });
        }

        // Search by current working status using pattern matching (Op.like)
        searchConditions.push({
          currentWorkingStatus: {
            [Op.like]: `%${search}%`,
          },
        });

        // Use Op.or to search across agent IDs and current working status
        if (searchConditions.length > 0) {
          whereClause[Op.and] = [
            {
              [Op.or]: searchConditions,
            },
          ];
        } else {
          // No matches found, return empty result
          return res.status(200).json({
            success: true,
            message: "No data found",
            data: {
              count: 0,
              rows: [],
            },
          });
        }
      } else {
        // No search term - filter by agent IDs only (if any agents found)
        if (agentIds.length > 0) {
          whereClause.agentId = {
            [Op.in]: agentIds,
          };
        } else {
          // No agents found, return empty result
          // For admin, this could happen if there are no agents at all
          // For team leader, this means no agents under their team
          return res.status(200).json({
            success: true,
            message: "No agents found",
            data: {
              count: 0,
              rows: [],
            },
          });
        }
      }

      // Fetch productivity logs
      const { count, rows } = await AgentProductivityLogs.findAndCountAll({
        where: whereClause,
        limit: limitValue,
        offset: offsetValue,
        order: [["date", "DESC"], ["agentId", "ASC"]],
      });

      // Map agent IDs to agent names
      const agentMap = new Map(
        agents.map((agent: any) => [agent.id, agent.name])
      );

      // Format response data - return stored values directly from database
      const formattedRows = rows.map((log: any) => {
        // Parse TEXT values to numbers for response
        const idleTime: number | null = log.idleTime !== null && log.idleTime !== undefined
          ? parseInt(String(log.idleTime), 10)
          : null;
        const activeTime = log.activeTime ? parseInt(String(log.activeTime), 10) : 0;

        return {
          id: log.id,
          agentId: log.agentId,
          agentName: agentMap.get(log.agentId) || "--",
          date: log.date,
          loginDatetime: log.loginDatetime
            ? moment
              .tz(log.loginDatetime, "Asia/Kolkata")
              .format("YYYY-MM-DD HH:mm:ss")
            : null,
          currentWorkingStatus: log.currentWorkingStatus || "Idle",
          assigned: log.assigned || 0,
          notPicked: log.notPicked || 0,
          picked: log.picked || 0,
          inprogress: log.inprogress || 0,
          cancelled: log.cancelled || 0,
          completed: log.completed || 0,
          // lastCaseAllocatedDateTime: log.lastCaseAllocatedDateTime
          //   ? moment
          //     .tz(log.lastCaseAllocatedDateTime, "Asia/Kolkata")
          //     .format("YYYY-MM-DD HH:mm:ss")
          //   : null,
          activeTime: activeTime,
          idleTime: idleTime,
        };
      });

      return res.status(200).json({
        success: true,
        message: "Agent productivity list fetched successfully",
        data: {
          count: count,
          rows: formattedRows,
        },
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  /**
   * Updates currentWorkingStatus for previous day's agent productivity logs
   * Called by cron scheduler at 5:00 AM daily
   * Sets status to "Present" if loginDatetime exists, "Absent" otherwise
   */
  export async function updatePreviousDayAgentProductivityStatus(
    req: Request,
    res: Response
  ) {
    try {
      // Get yesterday's date (previous day)
      const yesterday = moment.tz("Asia/Kolkata").subtract(1, "day").format("YYYY-MM-DD");

      // Find all agent productivity logs for yesterday
      const previousDayLogs = await AgentProductivityLogs.findAll({
        where: {
          date: yesterday,
        },
        attributes: ["id", "agentId", "loginDatetime", "currentWorkingStatus"],
      });

      if (previousDayLogs.length === 0) {
        return res.status(200).json({
          success: true,
          message: "No productivity logs found for previous day",
          data: {
            date: yesterday,
            updatedCount: 0,
          },
        });
      }

      // Update status based on loginDatetime
      let presentCount = 0;
      let absentCount = 0;

      for (const log of previousDayLogs) {
        const logData = log.dataValues || log;
        const newStatus = logData.loginDatetime ? "Present" : "Absent";

        // Only update if status is different
        if (logData.currentWorkingStatus !== newStatus) {
          await AgentProductivityLogs.update(
            {
              currentWorkingStatus: newStatus,
            },
            {
              where: {
                id: logData.id,
              },
            }
          );

          // Create sync record for agent productivity report
          Utils.createReportSyncTableRecord("agentProductivityReportDetails", [
            logData.id,
          ]);
        }

        if (newStatus === "Present") {
          presentCount++;
        } else {
          absentCount++;
        }
      }

      return res.status(200).json({
        success: true,
        message: "Previous day agent productivity status updated successfully",
        data: {
          date: yesterday,
          totalLogs: previousDayLogs.length,
          presentCount: presentCount,
          absentCount: absentCount,
        },
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }
}

