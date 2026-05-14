-- Enum types for closed value sets defined in spec section 7.
-- Open-ended sets (procedure_type, appointment_type, document.category,
-- message.attachments, etc.) use TEXT + CHECK or JSONB so they can extend
-- without a migration.

create type public.staff_role as enum (
  'surgeon',
  'optometrist',
  'nurse',
  'reception'
);

create type public.eye_side as enum ('left', 'right', 'both');

create type public.procedure_status as enum (
  'active',
  'completed',
  'cancelled'
);

create type public.appointment_location as enum (
  'in_clinic',
  'phone',
  'video'
);

create type public.appointment_status as enum (
  'to_book',
  'confirmed',
  'completed',
  'cancelled'
);

-- Patient-facing zone shown after a check-in.
-- Per spec: NEVER red — patients only see green/yellow/orange.
create type public.patient_zone as enum ('green', 'yellow', 'orange');

-- Staff-side alert level. Decoupled from patient_zone:
-- a Red staff alert collapses to Orange in patient_zone (calming).
create type public.staff_alert_level as enum (
  'none',
  'yellow',
  'orange',
  'red'
);

-- Routing-rule outcome. Spec section 6.7: 4-option router.
create type public.route_action as enum (
  'off',
  'yellow',
  'orange',
  'red'
);

-- Manual flag levels (staff-only — never shown to patient).
create type public.manual_flag_level as enum (
  'yellow',
  'orange',
  'red'
);

create type public.vision_assessment as enum ('worse', 'same', 'better');

create type public.message_sender_type as enum ('patient', 'staff');

create type public.message_thread_status as enum ('open', 'resolved');
