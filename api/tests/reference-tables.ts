/**
 * Tables the migrations fill with reference data (plans, promotions…). Tests empty every table
 * before each test, then copy these back from the snapshot taken once in global-setup.ts.
 */
export const REFERENCE_TABLES = ['plans', 'promotions', 'onboarding_template_items'] as const;
export const SNAPSHOT_SCHEMA = 'test_reference';
