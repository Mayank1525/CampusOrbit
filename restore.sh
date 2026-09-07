#!/usr/bin/env bash
# CampusOrbit - restore the runtime after a sandbox recycle.
#
# Source files persist in the workspace, but MongoDB, node_modules and the
# running processes do not. This script rebuilds everything that is missing.
# It is safe to re-run: each step is skipped when already satisfied.
set -euo pipefail

ROOT=/home/user
MONGO_DIR="$ROOT/.local/mongodb"
MONGO_URL=https://fastdl.mongodb.org/linux/mongodb-linux-x86_64-debian12-7.0.14.tgz

echo "==> 1/4  MongoDB binary"
if [ -x "$MONGO_DIR/bin/mongod" ]; then
  echo "    already installed"
else
  mkdir -p "$ROOT/.local"
  curl -sL -o /tmp/mongo.tgz "$MONGO_URL"
  tar -xzf /tmp/mongo.tgz -C /tmp
  rm -rf "$MONGO_DIR"
  mv /tmp/mongodb-linux-x86_64-debian12-7.0.14 "$MONGO_DIR"
  echo "    installed $("$MONGO_DIR/bin/mongod" --version | head -1)"
fi
mkdir -p "$ROOT/data/db"

echo "==> 2/4  Dependencies"
for d in "$ROOT/server" "$ROOT/client" "$ROOT"; do
  if [ -d "$d/node_modules" ]; then
    echo "    $(basename "$d"): present"
  else
    echo "    $(basename "$d"): installing..."
    (cd "$d" && npm install --no-audit --no-fund >/dev/null 2>&1)
  fi
done

echo "==> 3/4  MongoDB server"
if pgrep -f "mongod --dbpath $ROOT/data/db" >/dev/null 2>&1; then
  echo "    already running"
else
  "$MONGO_DIR/bin/mongod" --dbpath "$ROOT/data/db" \
    --bind_ip 127.0.0.1 --port 27017 --fork \
    --logpath "$ROOT/data/mongod.log"
  echo "    started on 127.0.0.1:27017"
fi

echo "==> 4/4  Seed check"
cd "$ROOT/server"
COUNT=$(node -e "
import('mongoose').then(async (m) => {
  await m.default.connect('mongodb://127.0.0.1:27017/campusorbit');
  console.log(await m.default.connection.db.collection('users').countDocuments());
  await m.default.disconnect();
}).catch(() => console.log(0));
")
if [ "$COUNT" -ge 6 ]; then
  echo "    database already seeded ($COUNT users)"
else
  echo "    seeding..."
  npm run seed >/dev/null 2>&1
  echo "    seeded"
fi

echo
echo "Runtime ready. Now start the two servers:"
echo "  cd /home/user/server && npm start      # API  :5000"
echo "  cd /home/user/client && npm run dev    # site :5173"
