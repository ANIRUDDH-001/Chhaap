"""Create a private SQL dump + raw media backup, or verify restoration in a NEW test database."""
import argparse
import os
import subprocess
import zipfile
from datetime import datetime, UTC
from pathlib import Path

from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from chhaap.settings import settings

ROOT = Path(__file__).resolve().parents[1]
BIN = Path(os.getenv('POSTGRES_BIN', r'C:\Program Files\PostgreSQL\18\bin'))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--verify', action='store_true', help='Restore into a new chhaap_test_backup_* database, never overwrite the shop')
    args = parser.parse_args()
    target = ROOT / '.data' / 'backups' / datetime.now(UTC).strftime('%Y%m%dT%H%M%S%fZ')
    target.mkdir(parents=True)
    url = make_url(settings.database_admin_url)
    env = {**os.environ, 'PGPASSWORD':url.password}
    common = ['-h',url.host,'-p',str(url.port or 5432),'-U',url.username]
    suffix = '.exe' if os.name == 'nt' else ''
    def pg(name, *arguments):
        subprocess.run([str(BIN/(name+suffix)),*common,*arguments],env=env,check=True,capture_output=True)
    dump = target/'shop.dump'
    pg('pg_dump','-Fc','-d',url.database,'-f',str(dump))
    with zipfile.ZipFile(target/'media.zip','w',zipfile.ZIP_DEFLATED) as archive:
        for path in settings.data_dir.rglob('*'):
            if path.is_file(): archive.write(path,path.relative_to(settings.data_dir))
    if args.verify:
        name = 'chhaap_test_backup_' + datetime.now(UTC).strftime('%Y%m%d%H%M%S%f')
        pg('createdb',name)
        pg('pg_restore','--exit-on-error','-d',name,str(dump))
        restored = create_engine(url.set(database=name))
        original = create_engine(settings.database_admin_url)
        try:
            with restored.connect() as db, original.connect() as source:
                for table in ['shops','requests','quotes','orders','payments']:
                    count = db.scalar(text(f'SELECT count(*) FROM {table}'))
                    assert count == source.scalar(text(f'SELECT count(*) FROM {table}'))
            print('Restoration verified against source row counts. Restored database: '+name)
        finally:
            restored.dispose(); original.dispose()
        # Keep the verified restore for operator inspection; never drop a database implicitly.
    print('Private backup saved: '+str(target))


if __name__ == '__main__': main()
