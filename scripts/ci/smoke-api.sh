#!/usr/bin/env bash

set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <base-url-or-api-base>"
  exit 1
fi

RAW_BASE_URL="${1%/}"
if [[ "$RAW_BASE_URL" == */api ]]; then
  API_BASE="$RAW_BASE_URL"
  ROOT_BASE="${RAW_BASE_URL%/api}"
else
  ROOT_BASE="$RAW_BASE_URL"
  API_BASE="$ROOT_BASE/api"
fi

TMP_DIR="$(mktemp -d)"
COOKIE_JAR="$TMP_DIR/papervest.cookies"
REGISTER_JSON="$TMP_DIR/register.json"
LOGIN_JSON="$TMP_DIR/login.json"
SESSION_JSON="$TMP_DIR/session.json"
HOME_JSON="$TMP_DIR/home.json"
DETAIL_JSON="$TMP_DIR/detail.json"
HISTORY_JSON="$TMP_DIR/history.json"
PORTFOLIO_JSON="$TMP_DIR/portfolio.json"
PORTFOLIO_HISTORY_JSON="$TMP_DIR/portfolio-history.json"
NOTIFICATIONS_JSON="$TMP_DIR/notifications.json"
CREATE_ORDER_JSON="$TMP_DIR/create-order.json"
LIST_ORDERS_JSON="$TMP_DIR/list-orders.json"
CANCEL_ORDER_JSON="$TMP_DIR/cancel-order.json"
BUY_JSON="$TMP_DIR/buy.json"
TRADES_JSON="$TMP_DIR/trades.json"
HEALTH_JSON="$TMP_DIR/health.json"
READINESS_JSON="$TMP_DIR/readiness.json"
LIVENESS_JSON="$TMP_DIR/liveness.json"
INFO_JSON="$TMP_DIR/info.json"
METRICS_JSON="$TMP_DIR/metrics.json"

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

SMOKE_TEST_MODE="${SMOKE_TEST_MODE:-full-register}"
SMOKE_TEST_EMAIL="${SMOKE_TEST_EMAIL:-}"
SMOKE_TEST_PASSWORD="${SMOKE_TEST_PASSWORD:-}"
SMOKE_TEST_DEVICE_NAME="${SMOKE_TEST_DEVICE_NAME:-CI Smoke}"

case "$SMOKE_TEST_MODE" in
  full-register|full-login|read-only-login)
    ;;
  *)
    echo "Unsupported SMOKE_TEST_MODE: $SMOKE_TEST_MODE"
    echo "Supported modes: full-register, full-login, read-only-login"
    exit 1
    ;;
esac

json_get() {
  node -e '
const fs = require("fs");
const [file, rawPath] = process.argv.slice(1);
const data = JSON.parse(fs.readFileSync(file, "utf8"));
const path = rawPath.replace(/\[(\d+)\]/g, ".$1").split(".").filter(Boolean);
let value = data;
for (const token of path) {
  const key = Number.isNaN(Number(token)) ? token : Number(token);
  value = value?.[key];
}
if (value === undefined) {
  process.exit(12);
}
if (typeof value === "object") {
  process.stdout.write(JSON.stringify(value));
} else {
  process.stdout.write(String(value));
}
' "$1" "$2"
}

assert_json_eq() {
  local file="$1"
  local path="$2"
  local expected="$3"
  local actual
  actual="$(json_get "$file" "$path")"
  if [[ "$actual" != "$expected" ]]; then
    echo "Expected $path to equal '$expected' but got '$actual'"
    cat "$file"
    exit 1
  fi
}

echo "==> Checking actuator health at $ROOT_BASE/actuator/health"
health_status="$(curl -sS -o "$HEALTH_JSON" -w "%{http_code}" "$ROOT_BASE/actuator/health")"
if [[ "$health_status" != "200" ]]; then
  echo "Health check failed with status $health_status"
  cat "$HEALTH_JSON"
  exit 1
fi
assert_json_eq "$HEALTH_JSON" "status" "UP"

echo "==> Checking actuator liveness at $ROOT_BASE/actuator/health/liveness"
liveness_status="$(curl -sS -o "$LIVENESS_JSON" -w "%{http_code}" "$ROOT_BASE/actuator/health/liveness")"
if [[ "$liveness_status" != "200" ]]; then
  echo "Liveness check failed with status $liveness_status"
  cat "$LIVENESS_JSON"
  exit 1
fi
assert_json_eq "$LIVENESS_JSON" "status" "UP"

echo "==> Checking actuator readiness at $ROOT_BASE/actuator/health/readiness"
readiness_status="$(curl -sS -o "$READINESS_JSON" -w "%{http_code}" "$ROOT_BASE/actuator/health/readiness")"
if [[ "$readiness_status" != "200" ]]; then
  echo "Readiness check failed with status $readiness_status"
  cat "$READINESS_JSON"
  exit 1
fi
assert_json_eq "$READINESS_JSON" "status" "UP"

echo "==> Bootstrapping CSRF cookie"
csrf_status="$(curl -sS -o /dev/null -w "%{http_code}" -c "$COOKIE_JAR" -b "$COOKIE_JAR" "$API_BASE/auth/csrf")"
if [[ "$csrf_status" != "204" ]]; then
  echo "CSRF bootstrap failed with status $csrf_status"
  exit 1
fi

if [[ "$SMOKE_TEST_MODE" == "full-register" ]]; then
  EMAIL="smoke-$(date +%s)-$RANDOM@example.com"
  PASSWORD="Abcd1234!"

  echo "==> Registering smoke user $EMAIL"
  register_status="$(curl -sS -o "$REGISTER_JSON" -w "%{http_code}" \
    -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"confirmPassword\":\"$PASSWORD\",\"deviceName\":\"$SMOKE_TEST_DEVICE_NAME\"}" \
    "$API_BASE/auth/register")"
  if [[ "$register_status" != "201" ]]; then
    echo "Register failed with status $register_status"
    cat "$REGISTER_JSON"
    exit 1
  fi
  assert_json_eq "$REGISTER_JSON" "user.email" "$EMAIL"
  ACCESS_TOKEN="$(json_get "$REGISTER_JSON" "accessToken")"
else
  if [[ -z "$SMOKE_TEST_EMAIL" || -z "$SMOKE_TEST_PASSWORD" ]]; then
    echo "SMOKE_TEST_EMAIL and SMOKE_TEST_PASSWORD are required when SMOKE_TEST_MODE=$SMOKE_TEST_MODE"
    exit 1
  fi

  EMAIL="$SMOKE_TEST_EMAIL"
  PASSWORD="$SMOKE_TEST_PASSWORD"

  echo "==> Logging in smoke user $EMAIL"
  login_status="$(curl -sS -o "$LOGIN_JSON" -w "%{http_code}" \
    -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"deviceName\":\"$SMOKE_TEST_DEVICE_NAME\"}" \
    "$API_BASE/auth/login")"
  if [[ "$login_status" != "200" ]]; then
    echo "Login failed with status $login_status"
    cat "$LOGIN_JSON"
    exit 1
  fi
  assert_json_eq "$LOGIN_JSON" "user.email" "$EMAIL"
  ACCESS_TOKEN="$(json_get "$LOGIN_JSON" "accessToken")"
fi

echo "==> Verifying cookie-backed session bootstrap"
session_status="$(curl -sS -o "$SESSION_JSON" -w "%{http_code}" -c "$COOKIE_JAR" -b "$COOKIE_JAR" "$API_BASE/auth/session")"
if [[ "$session_status" != "200" ]]; then
  echo "Session bootstrap failed with status $session_status"
  cat "$SESSION_JSON"
  exit 1
fi
assert_json_eq "$SESSION_JSON" "user.email" "$EMAIL"

echo "==> Checking authenticated actuator info payload"
info_status="$(curl -sS -o "$INFO_JSON" -w "%{http_code}" -H "Authorization: Bearer $ACCESS_TOKEN" "$ROOT_BASE/actuator/info")"
if [[ "$info_status" != "200" ]]; then
  echo "Actuator info request failed with status $info_status"
  cat "$INFO_JSON"
  exit 1
fi
assert_json_eq "$INFO_JSON" "application.name" "PaperVest API"
json_get "$INFO_JSON" "marketData.provider" >/dev/null
json_get "$INFO_JSON" "conditionalOrders.schedulerEnabled" >/dev/null

echo "==> Checking authenticated actuator metrics exposure"
metrics_status="$(curl -sS -o "$METRICS_JSON" -w "%{http_code}" -H "Authorization: Bearer $ACCESS_TOKEN" "$ROOT_BASE/actuator/metrics")"
if [[ "$metrics_status" != "200" ]]; then
  echo "Actuator metrics request failed with status $metrics_status"
  cat "$METRICS_JSON"
  exit 1
fi
json_get "$METRICS_JSON" "names[0]" >/dev/null

echo "==> Checking market home payload"
home_status="$(curl -sS -o "$HOME_JSON" -w "%{http_code}" -H "Authorization: Bearer $ACCESS_TOKEN" "$API_BASE/market/home")"
if [[ "$home_status" != "200" ]]; then
  echo "Home market request failed with status $home_status"
  cat "$HOME_JSON"
  exit 1
fi
assert_json_eq "$HOME_JSON" "quotes[0].symbol" "AAPL"

echo "==> Checking stock detail quote payload"
detail_status="$(curl -sS -o "$DETAIL_JSON" -w "%{http_code}" -H "Authorization: Bearer $ACCESS_TOKEN" "$API_BASE/market/stocks/AAPL")"
if [[ "$detail_status" != "200" ]]; then
  echo "Stock detail request failed with status $detail_status"
  cat "$DETAIL_JSON"
  exit 1
fi
assert_json_eq "$DETAIL_JSON" "symbol" "AAPL"
json_get "$DETAIL_JSON" "marketSession" >/dev/null
json_get "$DETAIL_JSON" "quoteTimestamp" >/dev/null

echo "==> Checking stock history payload"
history_status="$(curl -sS -o "$HISTORY_JSON" -w "%{http_code}" -H "Authorization: Bearer $ACCESS_TOKEN" "$API_BASE/market/stocks/AAPL/history?range=1M")"
if [[ "$history_status" != "200" ]]; then
  echo "Stock history request failed with status $history_status"
  cat "$HISTORY_JSON"
  exit 1
fi
assert_json_eq "$HISTORY_JSON" "symbol" "AAPL"
json_get "$HISTORY_JSON" "points[0].closePrice" >/dev/null

echo "==> Checking empty portfolio snapshot"
portfolio_status="$(curl -sS -o "$PORTFOLIO_JSON" -w "%{http_code}" -H "Authorization: Bearer $ACCESS_TOKEN" "$API_BASE/portfolio")"
if [[ "$portfolio_status" != "200" ]]; then
  echo "Portfolio request failed with status $portfolio_status"
  cat "$PORTFOLIO_JSON"
  exit 1
fi
json_get "$PORTFOLIO_JSON" "summary.cashBalance" >/dev/null

echo "==> Checking portfolio history path"
portfolio_history_status="$(curl -sS -o "$PORTFOLIO_HISTORY_JSON" -w "%{http_code}" -H "Authorization: Bearer $ACCESS_TOKEN" "$API_BASE/portfolio/history?range=ALL")"
if [[ "$portfolio_history_status" != "200" ]]; then
  echo "Portfolio history request failed with status $portfolio_history_status"
  cat "$PORTFOLIO_HISTORY_JSON"
  exit 1
fi
assert_json_eq "$PORTFOLIO_HISTORY_JSON" "range" "ALL"
json_get "$PORTFOLIO_HISTORY_JSON" "points" >/dev/null

echo "==> Checking conditional order list path"
list_orders_status="$(curl -sS -o "$LIST_ORDERS_JSON" -w "%{http_code}" -H "Authorization: Bearer $ACCESS_TOKEN" "$API_BASE/conditional-orders")"
if [[ "$list_orders_status" != "200" ]]; then
  echo "Conditional order list failed with status $list_orders_status"
  cat "$LIST_ORDERS_JSON"
  exit 1
fi
json_get "$LIST_ORDERS_JSON" "orders" >/dev/null

echo "==> Checking trade history path"
trades_status="$(curl -sS -o "$TRADES_JSON" -w "%{http_code}" -H "Authorization: Bearer $ACCESS_TOKEN" "$API_BASE/trades/history")"
if [[ "$trades_status" != "200" ]]; then
  echo "Trade history request failed with status $trades_status"
  cat "$TRADES_JSON"
  exit 1
fi
json_get "$TRADES_JSON" "trades" >/dev/null

echo "==> Checking notifications inbox path"
notifications_status="$(curl -sS -o "$NOTIFICATIONS_JSON" -w "%{http_code}" -H "Authorization: Bearer $ACCESS_TOKEN" "$API_BASE/notifications")"
if [[ "$notifications_status" != "200" ]]; then
  echo "Notifications request failed with status $notifications_status"
  cat "$NOTIFICATIONS_JSON"
  exit 1
fi
json_get "$NOTIFICATIONS_JSON" "notifications" >/dev/null
json_get "$NOTIFICATIONS_JSON" "unreadCount" >/dev/null

if [[ "$SMOKE_TEST_MODE" == "read-only-login" ]]; then
  echo "Smoke verification passed for $API_BASE"
  exit 0
fi

echo "==> Creating and cancelling a conditional order"
create_order_status="$(curl -sS -o "$CREATE_ORDER_JSON" -w "%{http_code}" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"symbol":"AAPL","side":"BUY","targetPrice":1,"quantity":1}' \
  "$API_BASE/conditional-orders")"
if [[ "$create_order_status" != "201" ]]; then
  echo "Conditional order creation failed with status $create_order_status"
  cat "$CREATE_ORDER_JSON"
  exit 1
fi
ORDER_ID="$(json_get "$CREATE_ORDER_JSON" "id")"
assert_json_eq "$CREATE_ORDER_JSON" "status" "ACTIVE"
list_orders_status="$(curl -sS -o "$LIST_ORDERS_JSON" -w "%{http_code}" -H "Authorization: Bearer $ACCESS_TOKEN" "$API_BASE/conditional-orders")"
if [[ "$list_orders_status" != "200" ]]; then
  echo "Conditional order list after create failed with status $list_orders_status"
  cat "$LIST_ORDERS_JSON"
  exit 1
fi
assert_json_eq "$LIST_ORDERS_JSON" "orders[0].id" "$ORDER_ID"

cancel_order_status="$(curl -sS -o "$CANCEL_ORDER_JSON" -w "%{http_code}" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -X POST "$API_BASE/conditional-orders/$ORDER_ID/cancel")"
if [[ "$cancel_order_status" != "200" ]]; then
  echo "Conditional order cancel failed with status $cancel_order_status"
  cat "$CANCEL_ORDER_JSON"
  exit 1
fi
assert_json_eq "$CANCEL_ORDER_JSON" "status" "CANCELLED"

echo "==> Exercising trade path"
buy_status="$(curl -sS -o "$BUY_JSON" -w "%{http_code}" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "X-Idempotency-Key: smoke-buy-1" \
  -H "Content-Type: application/json" \
  -d '{"symbol":"AAPL","companyName":"Apple Inc.","quantity":1}' \
  "$API_BASE/trades/buy")"

if [[ "$buy_status" == "200" ]]; then
  assert_json_eq "$BUY_JSON" "symbol" "AAPL"
  assert_json_eq "$BUY_JSON" "side" "BUY"
  trades_status="$(curl -sS -o "$TRADES_JSON" -w "%{http_code}" -H "Authorization: Bearer $ACCESS_TOKEN" "$API_BASE/trades/history")"
  if [[ "$trades_status" != "200" ]]; then
    echo "Trade history request after buy failed with status $trades_status"
    cat "$TRADES_JSON"
    exit 1
  fi
  assert_json_eq "$TRADES_JSON" "trades[0].symbol" "AAPL"
elif [[ "$buy_status" == "422" ]]; then
  assert_json_eq "$BUY_JSON" "code" "MARKET_CLOSED"
else
  echo "Trade smoke failed with unexpected status $buy_status"
  cat "$BUY_JSON"
  exit 1
fi

echo "Smoke verification passed for $API_BASE"
