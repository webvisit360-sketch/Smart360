WITH fixture AS (
  SELECT ARRAY['e8310f59-62a1-4d6c-8eb4-659c3e174c90','7a531ecd-3ccd-42b4-8baf-66fa25cfc6df']::uuid[] AS tenants,
         ARRAY['10320f88-5610-4d4e-adf9-5289612bdfd7','fcc158d0-1e86-431a-91b2-e3bc391a0774']::uuid[] AS hosts,
         ARRAY['mme2e-cbaf10ea3e73-a@example.invalid','mme2e-cbaf10ea3e73-b@example.invalid']::text[] AS emails,
         'mme2e-cbaf10ea3e73'::text AS marker
)
SELECT 'tenants_ids_or_marker' AS scope, count(*)::int AS remaining FROM tenants, fixture
 WHERE id=ANY(fixture.tenants) OR slug LIKE fixture.marker || '%' OR subtitle=fixture.marker
UNION ALL SELECT 'host_users_ids_or_emails', count(*)::int FROM host_users, fixture
 WHERE id=ANY(fixture.hosts) OR email=ANY(fixture.emails)
UNION ALL SELECT 'host_memberships', count(*)::int FROM host_memberships, fixture
 WHERE tenant_id=ANY(fixture.tenants) OR host_user_id=ANY(fixture.hosts)
UNION ALL SELECT 'host_sessions', count(*)::int FROM host_sessions, fixture WHERE host_user_id=ANY(fixture.hosts)
UNION ALL SELECT 'host_auth_events_ids_or_marker', count(*)::int FROM host_auth_events, fixture
 WHERE host_user_id=ANY(fixture.hosts) OR detail LIKE '%' || fixture.marker || '%'
UNION ALL SELECT 'host_password_resets', count(*)::int FROM host_password_resets, fixture WHERE host_user_id=ANY(fixture.hosts)
UNION ALL SELECT 'host_invites', count(*)::int FROM host_invites, fixture WHERE host_user_id=ANY(fixture.hosts)
UNION ALL SELECT 'tenant_aliases', count(*)::int FROM tenant_aliases, fixture
 WHERE tenant_id=ANY(fixture.tenants) OR slug LIKE fixture.marker || '%'
UNION ALL SELECT 'tenant_slug_reservations', count(*)::int FROM tenant_slug_reservations, fixture
 WHERE tenant_id=ANY(fixture.tenants) OR slug LIKE fixture.marker || '%'
UNION ALL SELECT 'changelog_ids_emails_or_marker', count(*)::int FROM changelog, fixture
 WHERE tenant_id=ANY(fixture.tenants) OR actor_id=ANY(fixture.hosts)
 OR actor_email=ANY(fixture.emails) OR detail LIKE '%' || fixture.marker || '%'
ORDER BY scope;
