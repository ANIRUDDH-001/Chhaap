"""Create an isolated loopback-only PostgreSQL cluster and ignored local configuration."""
from pathlib import Path
import os
import secrets
import subprocess

ROOT=Path(__file__).resolve().parents[1]
BIN=Path(os.getenv("POSTGRES_BIN",r"C:\Program Files\PostgreSQL\18\bin"))
DATA=ROOT/".data"; CLUSTER=DATA/"postgres"


def run(name,*args,**kwargs):
    return subprocess.run([str(BIN/(name+".exe")),*map(str,args)],check=True,**kwargs)


def main():
    DATA.mkdir(exist_ok=True)
    envfile=ROOT/".env"
    if not envfile.exists():
        admin=secrets.token_hex(24); app=secrets.token_hex(24)
        envfile.write_text(f"DATABASE_ADMIN_URL=postgresql+psycopg://chhaap_admin:{admin}@127.0.0.1:55432/chhaap\nDATABASE_URL=postgresql+psycopg://chhaap_app:{app}@127.0.0.1:55432/chhaap\nTEST_DATABASE_URL=postgresql+psycopg://chhaap_app:{app}@127.0.0.1:55432/chhaap_test\nOLLAMA_URL=http://127.0.0.1:11435\nOLLAMA_MODEL=gemma4:e4b\nFRONTEND_ORIGIN=http://localhost:5175\nCOOKIE_SECURE=false\n",encoding="utf-8")
    from dotenv import dotenv_values
    from sqlalchemy.engine import make_url
    values=dotenv_values(envfile);adminurl=make_url(values["DATABASE_ADMIN_URL"]);appurl=make_url(values["DATABASE_URL"])
    if not (CLUSTER/"PG_VERSION").exists():
        pw=DATA/"bootstrap-password.tmp";pw.write_text(adminurl.password,encoding="utf-8")
        try:run("initdb","-D",CLUSTER,"-U","chhaap_admin","--pwfile",pw,"-A","scram-sha-256","--encoding=UTF8","--locale=C",stdout=subprocess.DEVNULL)
        finally:pw.unlink(missing_ok=True)
    probe=subprocess.run([str(BIN/"pg_isready.exe"),"-h","127.0.0.1","-p","55432"],capture_output=True)
    if probe.returncode:
        run("pg_ctl","-D",CLUSTER,"-l",DATA/"postgres.log","-o","-p 55432 -h 127.0.0.1","-w","start",stdout=subprocess.DEVNULL)
    import psycopg
    connection=dict(host="127.0.0.1",port=55432,user="chhaap_admin",password=adminurl.password,dbname="postgres",autocommit=True)
    with psycopg.connect(**connection) as db:
        if not db.execute("SELECT 1 FROM pg_roles WHERE rolname='chhaap_app'").fetchone():
            db.execute(psycopg.sql.SQL("CREATE ROLE chhaap_app LOGIN PASSWORD {} NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS").format(psycopg.sql.Literal(appurl.password)))
        for name in ["chhaap","chhaap_test"]:
            if not db.execute("SELECT 1 FROM pg_database WHERE datname=%s",(name,)).fetchone():
                db.execute(psycopg.sql.SQL("CREATE DATABASE {} OWNER chhaap_admin").format(psycopg.sql.Identifier(name)))
    print("Local PostgreSQL ready on 127.0.0.1:55432. Credentials are in ignored .env.")


if __name__=="__main__":main()
