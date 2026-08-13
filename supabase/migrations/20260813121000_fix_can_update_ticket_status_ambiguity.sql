-- Root cause fix: an untracked 2-arg overload of
-- can_update_ticket_status(text, text DEFAULT NULL) existed in the live
-- database (not defined anywhere in this repo's SQL history), colliding with
-- the maintained 1-arg can_update_ticket_status(text) whenever a trigger
-- called it with a single argument. Postgres could not pick between the
-- 1-arg function and the 2-arg function (callable with 1 arg thanks to its
-- DEFAULT), raising "function ... is not unique" on every ticket
-- status/assignment/priority update.
--
-- No call site in this repo ever passes a second (team) argument, so the
-- 2-arg overload is dead code from an earlier, since-superseded permission
-- design. Drop it so only the actively maintained 1-arg version remains.
drop function if exists public.can_update_ticket_status(text, text);

-- Remove the temporary introspection helper used to diagnose this.
drop function if exists public.debug_list_can_update_overloads();
