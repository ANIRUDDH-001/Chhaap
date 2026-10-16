"""A narrow privileged queue claim, returning only one job descriptor."""
from alembic import op

revision='0002'
down_revision='0001'


def upgrade():
    op.execute('''CREATE FUNCTION public.claim_chhaap_job(worker text)
RETURNS TABLE(job_id uuid, tenant_id uuid) LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public AS $$
DECLARE picked uuid;
BEGIN
 PERFORM pg_advisory_xact_lock(7391821);
 UPDATE public.background_jobs SET status='failed',error='Processing stopped after three attempts. Retry or review manually.'
 WHERE status='running' AND lease_until<now() AND attempts>=3;
 IF (SELECT count(*) FROM public.background_jobs WHERE status='running' AND lease_until>now())>=1 THEN RETURN; END IF;
 SELECT id INTO picked FROM public.background_jobs
 WHERE (status='queued' AND available_at<=now() OR status='running' AND lease_until<now()) AND attempts<3
 ORDER BY available_at,created_at FOR UPDATE SKIP LOCKED LIMIT 1;
 IF picked IS NOT NULL THEN
  RETURN QUERY UPDATE public.background_jobs SET status='running',attempts=attempts+1,lease_owner=worker,lease_until=now()+interval '240 seconds'
  WHERE id=picked RETURNING id,shop_id;
 END IF;
END $$''')
    op.execute('REVOKE ALL ON FUNCTION public.claim_chhaap_job(text) FROM PUBLIC')
    op.execute('GRANT EXECUTE ON FUNCTION public.claim_chhaap_job(text) TO chhaap_app')


def downgrade():op.execute('DROP FUNCTION public.claim_chhaap_job(text)')
