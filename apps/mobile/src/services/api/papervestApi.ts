import type {
  ChangePasswordPayload,
  ConfirmEmailVerificationPayload,
  CreateConditionalOrderPayload,
  DeleteAccountPayload,
  LoginPayload,
  RequestPasswordResetPayload,
  RegisterPayload,
  ResetPasswordPayload,
  StockHistoryRange,
  TradeOrderPayload,
} from './types';

import { papervestApiClient } from './client';

export function login(payload: LoginPayload) {
  return papervestApiClient.login(payload);
}

export function register(payload: RegisterPayload) {
  return papervestApiClient.register(payload);
}

export function logout(refreshToken: string) {
  return papervestApiClient.logout(refreshToken);
}

export function refreshAuth(refreshToken: string, deviceName?: string) {
  return papervestApiClient.refreshAuth({
    refreshToken,
    deviceName,
  });
}

export function getHomeMarket() {
  return papervestApiClient.getHomeMarket();
}

export function searchStocks(query: string) {
  return papervestApiClient.searchStocks(query);
}

export function getStockDetail(symbol: string) {
  return papervestApiClient.getStockDetail(symbol);
}

export function getStockHistory(symbol: string, range: StockHistoryRange) {
  return papervestApiClient.getStockHistory(symbol, range);
}

export function getWatchlist() {
  return papervestApiClient.getWatchlist();
}

export function addWatchlistItem(symbol: string, companyName?: string) {
  return papervestApiClient.addWatchlistItem(symbol, companyName);
}

export function removeWatchlistItem(symbol: string) {
  return papervestApiClient.removeWatchlistItem(symbol);
}

export function getPortfolio() {
  return papervestApiClient.getPortfolio();
}

export function getAccountProfile() {
  return papervestApiClient.getAccountProfile();
}

export function changePassword(payload: ChangePasswordPayload) {
  return papervestApiClient.changePassword(payload);
}

export function requestEmailVerification() {
  return papervestApiClient.requestEmailVerification();
}

export function requestPasswordReset(payload: RequestPasswordResetPayload) {
  return papervestApiClient.requestPasswordReset(payload);
}

export function resetPassword(payload: ResetPasswordPayload) {
  return papervestApiClient.resetPassword(payload);
}

export function confirmEmailVerification(payload: ConfirmEmailVerificationPayload) {
  return papervestApiClient.confirmEmailVerification(payload);
}

export function deleteAccount(payload: DeleteAccountPayload) {
  return papervestApiClient.deleteAccount(payload);
}

export function getTradeHistory() {
  return papervestApiClient.getTradeHistory();
}

export function createConditionalOrder(payload: CreateConditionalOrderPayload) {
  return papervestApiClient.createConditionalOrder(payload);
}

export function getConditionalOrders() {
  return papervestApiClient.getConditionalOrders();
}

export function cancelConditionalOrder(orderId: string) {
  return papervestApiClient.cancelConditionalOrder(orderId);
}

export function buyStock(payload: TradeOrderPayload, idempotencyKey: string) {
  return papervestApiClient.buyStock(payload, idempotencyKey);
}

export function sellStock(payload: TradeOrderPayload, idempotencyKey: string) {
  return papervestApiClient.sellStock(payload, idempotencyKey);
}
