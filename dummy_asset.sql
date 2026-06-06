-- =============================================================================
-- DUMMY ASSET: Bell UH-1H "NAS-001" — Full dataset
-- Run AFTER the standard seeders (units, asset_types, component_types, etc.)
-- Assumes default seeder insertion order for lookup IDs.
-- =============================================================================

SET FOREIGN_KEY_CHECKS = 0;

-- ---------------------------------------------------------------------------
-- 1. ASSET
--    unit_id 2  = '601 AVN BN-JAJI'
--    asset_type_id 1 = 'Bell UH-1H'
-- ---------------------------------------------------------------------------
INSERT INTO assets
  (id, type, unit_id, asset_type_id, name, serial_number, model,
   serviceability_status, tail_number, operation_status,
   manufacturer, purchase_date, landings, created_at, updated_at)
VALUES
  (9001, 'aircraft', 2, 1, 'NAS-001 Iroquois', 'UH1H-66-16001', 'Bell UH-1H',
   'serviceable', 'NAF-001', 'available',
   'Bell Helicopter', '2018-03-15', '1240', NOW(), NOW());

-- ---------------------------------------------------------------------------
-- 2. COMPONENTS  (asset_id = 9001)
--    component_type_id:  9 = Main Rotor Blades, 10 = Swashplate Assembly,
--                        11 = Tail Rotor Hub,   13 = Landing Skids
--    ata_chapter_id:     NULL (safe — nullable FK)
--    maintenance_strategy: hard-time | on-condition | condition
-- ---------------------------------------------------------------------------
INSERT INTO components
  (id, asset_id, component_type_id, ata_chapter_id, part_number, serial_number,
   time_since_new, service_life_limit_hours, last_inspection, inspection_interval,
   inspection_interval_unit, installed_at, maintenance_strategy,
   created_at, updated_at)
VALUES
  -- Main Rotor Blades — added new, 3000-hr hard-time life, 300-hr inspection
  (8001, 9001, 9,  NULL, 'BH-204-100-001', 'MRB-2024-0041',
   0.00, 3000.00, 820.00, 300.00, 'hours', '2024-01-10', 'hard-time', NOW(), NOW()),

  -- Swashplate Assembly — installed with 340 hrs, 2000-hr life, 200-hr interval
  (8002, 9001, 10, NULL, 'BH-204-200-007', 'SWP-2021-1188',
   340.00, 2000.00, 950.00, 200.00, 'hours', '2021-06-20', 'hard-time', NOW(), NOW()),

  -- Tail Rotor Hub — added new, condition-based, 6-month inspection
  (8003, 9001, 11, NULL, 'BH-204-300-003', 'TRH-2023-0772',
   0.00, NULL, 1020.00, 6.00, 'months', '2023-03-05', 'on-condition', NOW(), NOW()),

  -- Landing Skids — installed with 120 hrs, on-condition, 12-month interval
  (8004, 9001, 13, NULL, 'BH-204-400-011', 'LSK-2020-0333',
   120.00, NULL, 800.00, 12.00, 'months', '2020-09-01', 'on-condition', NOW(), NOW());

-- ---------------------------------------------------------------------------
-- 3. ENGINES  (asset_id = 9001)
--    position_id:   1 = 'Primary Engine'
--    category_id:   1 = 'Engine'
-- ---------------------------------------------------------------------------
INSERT INTO engines
  (id, asset_id, position_id, category_id, ata_chapter_id, serial_number, model,
   installation_date, service_life_limit, time_since_new,
   last_inspection, inspection_interval_unit, inspection_interval,
   maintenance_strategy, created_at, updated_at)
VALUES
  -- Lycoming T53-L-13B — installed new, 3600-hr TBO, 600-hr inspection
  (7001, 9001, 1, 1, NULL, 'T53-LYC-88174', 'Lycoming T53-L-13B',
   '2024-01-10', 3600.00, 0.00,
   820.00, 'hours', 600.00,
   'hard-time', NOW(), NOW());

-- ---------------------------------------------------------------------------
-- 4. AVIONICS  (asset_id = 9001)
--    avionic_category_id: 1 = GPS, 2 = VHF Communication Radio, 5 = Transponder
-- ---------------------------------------------------------------------------
INSERT INTO avionics
  (id, asset_id, avionic_category_id, ata_chapter_id, serial_number, model,
   manufacturer, installed_at, time_since_new, service_life_limit,
   last_inspection, inspection_interval_unit, inspection_interval,
   maintenance_strategy, created_at, updated_at)
VALUES
  -- GPS — added new, 10-yr / no-hours limit, 12-month inspection
  (6001, 9001, 1, NULL, 'GPS-GRMN-0041', 'Garmin GNS 530W',
   'Garmin', '2024-01-10', 0.00, NULL,
   820.00, 'months', 12.00, 'on-condition', NOW(), NOW()),

  -- VHF Radio — installed with 200 hrs, 5000-hr life
  (6002, 9001, 2, NULL, 'VHF-BNDX-9921', 'Bendix King KX-155',
   'Bendix King', '2021-06-20', 200.00, 5000.00,
   950.00, 'hours', 500.00, 'hard-time', NOW(), NOW()),

  -- Transponder — added new, on-condition, 24-month inspection
  (6003, 9001, 5, NULL, 'XPD-GRMN-7721', 'Garmin GTX 335',
   'Garmin', '2022-11-15', 0.00, NULL,
   NULL, 'months', 24.00, 'on-condition', NOW(), NOW());

-- ---------------------------------------------------------------------------
-- 5. OPERATIONS  (asset_id = 9001)
--    operation_type_id: NULL safe (nullable)
--    unit_id: 2
-- ---------------------------------------------------------------------------
INSERT INTO operations
  (id, unit_id, operation_type_id, asset_id, name, priority, is_flight,
   description, status, created_at, updated_at)
VALUES
  (5001, 2, NULL, 9001, 'Patrol Flight — Northern Sector',   'medium', 1, 'Routine northern sector patrol sortie.', 'completed', '2024-03-10 07:00:00', '2024-03-10 10:30:00'),
  (5002, 2, NULL, 9001, 'Medevac Mission — Kaiama',           'high',   1, 'Emergency medical evacuation to Kaiama.',  'completed', '2024-05-22 14:15:00', '2024-05-22 17:00:00'),
  (5003, 2, NULL, 9001, 'VIP Transport — GOC Inspection',    'high',   1, 'Transporting GOC for annual inspection.',   'completed', '2024-07-04 08:00:00', '2024-07-04 11:20:00'),
  (5004, 2, NULL, 9001, 'Troop Insertion — Exercise EAGLE',  'medium', 1, 'Troop insertion during Exercise Eagle.',    'completed', '2024-09-18 06:00:00', '2024-09-18 09:45:00'),
  (5005, 2, NULL, 9001, 'Patrol Flight — Southern Axis',     'low',    1, 'Routine southern axis patrol sortie.',      'completed', '2025-01-14 07:30:00', '2025-01-14 10:45:00'),
  (5006, 2, NULL, 9001, 'Scheduled Maintenance Flight Test', 'low',    1, 'Post-maintenance test flight.',             'completed', '2025-03-05 09:00:00', '2025-03-05 10:30:00');

-- operation_asset pivot (flight hours per sortie)
INSERT INTO operation_asset
  (operation_id, asset_id, flight_hours, created_at, updated_at)
VALUES
  (5001, 9001, 3.50, '2024-03-10 10:30:00', '2024-03-10 10:30:00'),
  (5002, 9001, 2.75, '2024-05-22 17:00:00', '2024-05-22 17:00:00'),
  (5003, 9001, 3.33, '2024-07-04 11:20:00', '2024-07-04 11:20:00'),
  (5004, 9001, 3.75, '2024-09-18 09:45:00', '2024-09-18 09:45:00'),
  (5005, 9001, 3.25, '2025-01-14 10:45:00', '2025-01-14 10:45:00'),
  (5006, 9001, 1.50, '2025-03-05 10:30:00', '2025-03-05 10:30:00');

-- ---------------------------------------------------------------------------
-- 6. MAINTENANCE EVENTS
-- ---------------------------------------------------------------------------
INSERT INTO maintenance_events
  (id, asset_id, component_id, performed_by, event_type, inspection_name,
   description, work_done, started_at, completed_at, hours_logged,
   status, aircraft_airworthiness, remarks, created_at, updated_at)
VALUES
  (4001, 9001, 8001, NULL, '100-hour', '100-hr Phase Inspection',
   'Scheduled 100-hr phase inspection of main rotor blades.',
   'Inspected blade root fittings, leading edge erosion, tracking. All within limits.',
   '2024-06-10 08:00:00', '2024-06-10 16:30:00', 8.50,
   'serviceable', 'airworthy', 'Nil defects found.', NOW(), NOW()),

  (4002, 9001, 7001, NULL, '600-hour', '600-hr Engine Inspection',
   'Scheduled 600-hr engine hot section inspection.',
   'Removed and inspected turbine blades, combustion liner, fuel nozzles. Replaced two turbine blades.',
   '2024-10-05 07:00:00', '2024-10-07 17:00:00', 26.00,
   'serviceable', 'airworthy', 'Two turbine blades replaced on limits.', NOW(), NOW()),

  (4003, 9001, 8002, NULL, 'overhaul', 'Swashplate Assembly Overhaul',
   '200-hr swashplate inspection and bearing replacement.',
   'Disassembled swashplate, replaced upper and lower bearings, re-greased and reassembled.',
   '2025-01-20 08:00:00', '2025-01-21 15:00:00', 14.00,
   'serviceable', 'airworthy', 'New bearings installed.', NOW(), NOW());

-- ---------------------------------------------------------------------------
-- 7. DEFECTS
-- ---------------------------------------------------------------------------
INSERT INTO defects
  (id, asset_id, operation_id, work_order_id, reported_by, component_id,
   engine_id, avionics_id, title, description, resolution,
   severity, status, reported_at, reported_hours, resolved_at, remarks,
   created_at, updated_at)
VALUES
  -- Resolved hydraulic leak
  (3001, 9001, 5001, NULL, NULL, 8001, NULL, NULL,
   'Hydraulic fluid seepage — main rotor head',
   'Pilot reported slight hydraulic seepage around main rotor head pitch link after sortie.',
   'Inspected and replaced O-ring on pitch link hydraulic line. Ground run confirmed nil leak.',
   'medium', 'resolved', '2024-03-10 11:00:00', 823.50, '2024-03-15 14:00:00',
   'O-ring replaced, serviceable.', NOW(), NOW()),

  -- Resolved engine oil pressure warning
  (3002, 9001, 5002, NULL, NULL, NULL, 7001, NULL,
   'Low engine oil pressure indication',
   'In-flight low oil pressure caution light illuminated briefly during cruise.',
   'Post-flight engine oil system check found partially blocked oil filter. Filter replaced.',
   'high', 'resolved', '2024-05-22 17:30:00', 849.25, '2024-05-25 12:00:00',
   'Oil filter replaced, pressure normal.', NOW(), NOW()),

  -- Open — VHF radio intermittent
  (3003, 9001, 5004, NULL, NULL, NULL, NULL, 6002,
   'VHF radio — intermittent transmission',
   'Crew reported intermittent VHF transmit capability during sortie. Receive normal.',
   NULL,
   'medium', 'open', '2024-09-18 10:00:00', 876.00, NULL,
   'Pending avionics shop inspection.', NOW(), NOW()),

  -- Open — tail skid crack
  (3004, 9001, NULL, NULL, NULL, 8004, NULL, NULL,
   'Hairline crack observed on left landing skid cross tube',
   'Post-flight walkaround revealed hairline crack on left forward cross tube weld.',
   NULL,
   'critical', 'in_progress', '2025-01-14 11:00:00', 921.50, NULL,
   'Aircraft grounded pending structural assessment.', NOW(), NOW());

-- ---------------------------------------------------------------------------
-- 8. WORK ORDERS
-- ---------------------------------------------------------------------------
INSERT INTO work_orders (id, asset_id, reported_by, title, created_at, updated_at)
VALUES
  (2001, 9001, NULL, 'WO-2024-001: 100-hr Phase Inspection', NOW(), NOW()),
  (2002, 9001, NULL, 'WO-2024-002: 600-hr Engine Hot Section', NOW(), NOW()),
  (2003, 9001, NULL, 'WO-2025-001: Swashplate 200-hr Overhaul', NOW(), NOW()),
  (2004, 9001, NULL, 'WO-2025-002: VHF Radio Defect Investigation', NOW(), NOW());

-- ---------------------------------------------------------------------------
-- 9. WORK ORDER TASKS
-- ---------------------------------------------------------------------------
INSERT INTO work_order_tasks
  (id, work_order_id, maintenance_program_id, defect_id, personnel_id,
   component_id, engine_id, avionics_id, description, task_type,
   actual_labour_hours, labour_rate, status, created_at, updated_at)
VALUES
  -- WO 2001 — 100-hr phase: two tasks
  (1001, 2001, NULL, NULL, NULL, 8001, NULL, NULL,
   'Inspect main rotor blade root fittings and leading edge erosion per MM 62-10-0.',
   'routine', 4.00, 8500.00, 'completed', NOW(), NOW()),

  (1002, 2001, NULL, NULL, NULL, 8002, NULL, NULL,
   'Lubricate and inspect swashplate assembly per MM 62-21-0.',
   'routine', 3.00, 8500.00, 'completed', NOW(), NOW()),

  -- WO 2002 — 600-hr engine inspection: two tasks
  (1003, 2002, NULL, NULL, NULL, NULL, 7001, NULL,
   'Perform engine hot section inspection; remove turbine blades and inspect per MM 72-30-0.',
   'routine', 16.00, 9500.00, 'completed', NOW(), NOW()),

  (1004, 2002, NULL, 3002, NULL, NULL, 7001, NULL,
   'Inspect and replace engine oil filter; rectify low oil pressure defect.',
   'non_routine', 2.00, 9500.00, 'completed', NOW(), NOW()),

  -- WO 2003 — swashplate overhaul
  (1005, 2003, NULL, NULL, NULL, 8002, NULL, NULL,
   'Disassemble swashplate, replace upper and lower bearings, reassemble and rig per MM 62-21-0.',
   'routine', 14.00, 8500.00, 'completed', NOW(), NOW()),

  -- WO 2004 — VHF radio defect
  (1006, 2004, NULL, 3003, NULL, NULL, NULL, 6002,
   'Inspect VHF transceiver connectors and antenna feedline; repair intermittent transmission.',
   'non_routine', NULL, NULL, 'pending', NOW(), NOW());

-- ---------------------------------------------------------------------------
-- 10. COMPLIANCE HISTORIES
--     hours_at_completion = cumulative flight hours when task closed
-- ---------------------------------------------------------------------------
INSERT INTO compliance_histories
  (id, work_order_task_id, component_id, engine_id, avionics_id,
   description, hours_at_completion,
   next_due_date, next_due_hours, completion_date, created_at, updated_at)
VALUES
  -- Task 1001: MRB 100-hr inspection at 820 hrs → next due at 1120 hrs
  (101, 1001, 8001, NULL, NULL,
   '100-hr main rotor blade inspection completed. No discrepancies.',
   820.00, '2024-10-01 00:00:00', 1120.00, '2024-06-10 16:30:00', NOW(), NOW()),

  -- Task 1002: Swashplate lube at 820 hrs → next due at 1020 hrs
  (102, 1002, 8002, NULL, NULL,
   'Swashplate assembly lubricated and inspected. Bearings serviceable.',
   820.00, '2024-09-01 00:00:00', 1020.00, '2024-06-10 16:30:00', NOW(), NOW()),

  -- Task 1003: Engine hot section at 820 hrs → next due at 1420 hrs
  (103, 1003, NULL, 7001, NULL,
   '600-hr engine hot section completed. Two turbine blades replaced.',
   820.00, '2025-04-01 00:00:00', 1420.00, '2024-10-07 17:00:00', NOW(), NOW()),

  -- Task 1004: Oil filter replacement at 849.25 hrs
  (104, 1004, NULL, 7001, NULL,
   'Engine oil filter replaced. Oil pressure confirmed normal.',
   849.25, NULL, NULL, '2024-05-25 12:00:00', NOW(), NOW()),

  -- Task 1005: Swashplate 200-hr overhaul at 950 hrs → next due at 1150 hrs
  (105, 1005, 8002, NULL, NULL,
   'Swashplate bearings replaced. Assembly re-rigged and ground-run checked.',
   950.00, '2025-07-01 00:00:00', 1150.00, '2025-01-21 15:00:00', NOW(), NOW());

SET FOREIGN_KEY_CHECKS = 1;

-- =============================================================================
-- SUMMARY
-- =============================================================================
-- Asset        : NAS-001 Iroquois (Bell UH-1H) — id 9001
-- Components   : Main Rotor Blades, Swashplate, Tail Rotor Hub, Landing Skids
-- Engines      : Lycoming T53-L-13B (Primary Engine)
-- Avionics     : Garmin GNS 530W GPS, Bendix King VHF Radio, Garmin GTX 335 Transponder
-- Operations   : 6 completed sorties (totalling ~18 flight hours)
-- Maint Events : 3 (100-hr phase, 600-hr engine, swashplate overhaul)
-- Defects      : 4 (2 resolved, 1 open, 1 in_progress/critical)
-- Work Orders  : 4 (WO-2024-001/002, WO-2025-001/002)
-- WO Tasks     : 6 tasks across all work orders
-- Compliance   : 5 compliance history records
-- =============================================================================
