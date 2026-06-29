"""Test-only Postgres daemon.

Starts a real PostgreSQL via pgserver, applies the FROZEN Phase 2 Step 1
migration (with the btree_gist extension + GiST exclusion constraint stripped,
because the sandbox's bundled PostgreSQL build ships without btree_gist), prints
the connection URI on stdout, and stays alive until terminated.

The repository layer never depends on the exclusion constraint, so stripping it
does not affect what is under test. The migration file itself is NOT modified.
"""
import os
import re
import signal
import sys
import tempfile

import pgserver

MIGRATION = os.environ["MIGRATION_SQL"]


def load_migration() -> str:
    sql = open(MIGRATION).read()
    sql = sql.replace(
        "create extension if not exists btree_gist;",
        "-- btree_gist unavailable in sandbox build (stripped for tests only)",
    )
    # remove the exclusion constraint block (last constraint inside fee_profiles)
    sql = re.sub(
        r",\s*\n\s*-- G-4:.*?daterange\(effective_date, end_date, '\[\]'\) with &&\s*\n\s*\)",
        "",
        sql,
        flags=re.S,
    )
    return sql


def main() -> None:
    data_dir = tempfile.mkdtemp(prefix="repo-pg-")
    db = pgserver.get_server(data_dir)
    db.psql(load_migration())
    sys.stdout.write(db.get_uri() + "\n")
    sys.stdout.flush()

    def _stop(*_):
        try:
            db.cleanup()
        finally:
            sys.exit(0)

    signal.signal(signal.SIGTERM, _stop)
    signal.signal(signal.SIGINT, _stop)
    signal.pause()


if __name__ == "__main__":
    main()
