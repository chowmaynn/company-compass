/**
 * Shared constants — single source of truth for magic values
 * that were previously scattered across multiple files.
 */

/** Liam Ottley's YouTube channel ID */
export const LIAM_CHANNEL_ID = "UCui4jxDaMb53Gdh-AZUTPAg";

/** Close.com sales pipeline ID */
export const SALES_PIPELINE_ID = "pipe_0Wd57vBUsq5RErzmTF0IvW";

/** Calendly sales event names — all sources of inbound sales calls */
export const SALES_EVENT_NAMES = [
  "AAA Accelerator Business Call (Email)",
  "AAA Accelerator Business Call (Google)",
  "AAA Accelerator Business Call (Masterclass)",
  "AAA Accelerator Business Call (Skool A)",
  "AAA Accelerator Business Call (Skool C)",
  "AAA Accelerator Business Call (Skool P)",
  "AAA Accelerator Business Call (Website)",
  "AAA Accelerator Business Call (Welcome Email)",
];

/** Calendly follow-up event names */
export const FOLLOWUP_EVENT_NAMES = [
  "AAA Accelerator Follow-up (Callum Crees)",
  "AAA Accelerator Follow-up (Harry Hawkes)",
  "AAA Accelerator Follow-up (Jamie Patterson)",
  "AAA Accelerator Follow-up (Joel Price)",
  "AAA Accelerator Follow-up (Kevin Taheryan)",
  "AAA Accelerator Follow-up (Richard Mach)",
];

/**
 * Public-facing sales events — subset used for booking KPIs and charts.
 * These define what counts as a "sales booking" in the Supabase metrics cube.
 */
export const PUBLIC_SALES_EVENTS = [
  "AAA Accelerator Business Call (Website)",
  "AAA Accelerator Business Call (Website B)",
  "AAA Accelerator Business Call (Website C)",
  "AAA Accelerator Business Call (Skool A)",
  "AAA Accelerator Business Call (Skool C)",
  "AAA Accelerator Business Call (Skool P)",
  "AAA Accelerator Business Call (Welcome Email)",
  "AAA Accelerator Business Call (Email)",
  "AAA Accelerator Business Call (Masterclass)",
];
