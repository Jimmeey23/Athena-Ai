
-- ============ 1. SECURITY DEFINER VIEW -> security_invoker ============
ALTER VIEW public.v_trainer_qualification_matrix SET (security_invoker = on);

-- ============ 2. FUNCTION SEARCH PATH MUTABLE ============
ALTER FUNCTION public.current_app_user_id() SET search_path = public;
ALTER FUNCTION public.require_app_user_id() SET search_path = public;
ALTER FUNCTION public.set_physique57_trial_form_updated_at() SET search_path = public;
ALTER FUNCTION public.set_updated_at() SET search_path = public;
ALTER FUNCTION public.match_knowledge_chunks(vector, integer, double precision) SET search_path = public;
ALTER FUNCTION public.match_physique57_knowledge(vector, integer, jsonb) SET search_path = public;

-- ============ 3. REVOKE anon EXECUTE on SECURITY DEFINER functions ============
REVOKE EXECUTE ON FUNCTION public.can_access_ticket(uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.can_update_ticket_status(text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.current_user_assignment_keys() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.current_user_role() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.delete_custom_rule(text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.delete_schedule(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_bootstrap_catalog() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_user_workspace_state(integer, integer) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_active_admin(text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.save_csv_summary(text, jsonb, jsonb) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.save_custom_rule(text, jsonb) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.save_schedule(text, text, jsonb, numeric, boolean) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.save_week_actuals(uuid, text, text, jsonb, timestamp with time zone) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.set_schedule_lock(uuid, boolean) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.upsert_qualification_override(text, text, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.upsert_rule_override(text, boolean, integer) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.upsert_trainer_settings(text, jsonb) FROM anon, public;

-- Trigger / event-trigger / internal functions: not callable directly by any client role
REVOKE EXECUTE ON FUNCTION public.create_profile_for_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.enforce_ticket_status_owner() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.set_physique57_trial_form_updated_at() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM anon, authenticated, public;

-- ============ 4. HARDCODED ADMIN IDENTITY -> admin_users lookup ============
CREATE OR REPLACE FUNCTION public.is_active_admin(user_email text DEFAULT auth.email())
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE active = true
      AND lower(email) = lower(coalesce(user_email, auth.email()))
  );
$function$;

-- ============ 5. PROFILES ROLE ESCALATION ============
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- ============ 6. FORM_SUBMISSIONS: restrict reads/deletes to admins ============
DROP POLICY IF EXISTS "Allow authenticated reads" ON public.form_submissions;
DROP POLICY IF EXISTS "submissions: authenticated read" ON public.form_submissions;
DROP POLICY IF EXISTS "submissions: authenticated delete" ON public.form_submissions;
DROP POLICY IF EXISTS "Allow anonymous inserts" ON public.form_submissions;
DROP POLICY IF EXISTS "submissions: public insert" ON public.form_submissions;

CREATE POLICY "form_submissions_admin_read" ON public.form_submissions
  FOR SELECT TO authenticated
  USING (public.current_user_role() = 'admin');

CREATE POLICY "form_submissions_admin_delete" ON public.form_submissions
  FOR DELETE TO authenticated
  USING (public.current_user_role() = 'admin');

CREATE POLICY "form_submissions_public_insert" ON public.form_submissions
  FOR INSERT TO anon, authenticated
  WITH CHECK (form_id IS NOT NULL AND char_length(form_id) > 0);

-- ============ 7. FORMS: public read, admin-only writes ============
DROP POLICY IF EXISTS "forms: authenticated full access" ON public.forms;

CREATE POLICY "forms_authenticated_read" ON public.forms
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "forms_admin_insert" ON public.forms
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() = 'admin');

CREATE POLICY "forms_admin_update" ON public.forms
  FOR UPDATE TO authenticated
  USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');

CREATE POLICY "forms_admin_delete" ON public.forms
  FOR DELETE TO authenticated
  USING (public.current_user_role() = 'admin');

-- ============ 8. FINALISED_SCHEDULES: admin-only writes ============
DROP POLICY IF EXISTS "finalised_schedules_authenticated_insert" ON public.finalised_schedules;
DROP POLICY IF EXISTS "finalised_schedules_authenticated_update" ON public.finalised_schedules;

CREATE POLICY "finalised_schedules_admin_insert" ON public.finalised_schedules
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() = 'admin');

CREATE POLICY "finalised_schedules_admin_update" ON public.finalised_schedules
  FOR UPDATE TO authenticated
  USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');

-- ============ 9. STUDIO_RULES: remove anon writes, admin-only writes ============
DROP POLICY IF EXISTS "studio_rules_backend_insert" ON public.studio_rules;
DROP POLICY IF EXISTS "studio_rules_backend_update" ON public.studio_rules;

CREATE POLICY "studio_rules_admin_insert" ON public.studio_rules
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() = 'admin');

CREATE POLICY "studio_rules_admin_update" ON public.studio_rules
  FOR UPDATE TO authenticated
  USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');

-- ============ 10. TICKET ATTACHMENTS: ownership-scoped delete/update ============
DROP POLICY IF EXISTS "Authenticated users can delete ticket attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update ticket attachments" ON storage.objects;

CREATE POLICY "ticket_attachments_owner_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'ticket-attachments'
    AND (owner = auth.uid() OR public.current_user_role() = 'admin')
  );

CREATE POLICY "ticket_attachments_owner_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'ticket-attachments'
    AND (owner = auth.uid() OR public.current_user_role() = 'admin')
  )
  WITH CHECK (
    bucket_id = 'ticket-attachments'
    AND (owner = auth.uid() OR public.current_user_role() = 'admin')
  );
;
