*** Variables ***
# ── LOGIN ────────────────────────────────────────────────────────
${LOGIN_PAGE}              css:[data-testid="login-page"]
${LOGIN_CARD}              css:[data-testid="login-card"]
${LOGIN_FORM}              css:[data-testid="login-form"]
${LOGIN_EMAIL_INPUT}       css:[data-testid="login-email-input"]
${LOGIN_PASSWORD_INPUT}    css:[data-testid="login-password-input"]
${LOGIN_SHOW_PWD_BTN}      css:[data-testid="login-show-password-btn"]
${LOGIN_SUBMIT_BTN}        css:[data-testid="login-submit-btn"]
${LOGIN_ERROR_MSG}         css:[data-testid="login-error-msg"]
${LOGIN_SECURITY_NOTE}     css:[data-testid="login-security-note"]
${LOGIN_TITLE}             css:[data-testid="login-title"]

# ── HEADER ───────────────────────────────────────────────────────
${APP_HEADER}              css:[data-testid="app-header"]
${HEADER_TITLE}            css:[data-testid="header-title"]
${HEADER_PANEL}            css:[data-testid="header-panel"]
${AUTOBOT_TOGGLE_BTN}      css:[data-testid="autobot-toggle-btn"]
${AUTOBOT_STATUS}          css:[data-testid="autobot-status"]
${BALANCE_DISPLAY}         css:[data-testid="balance-display"]
${BALANCE_AMOUNT}          css:[data-testid="balance-amount"]
${DRAWDOWN_BADGE}          css:[data-testid="drawdown-badge"]
${OPEN_TRADES_COUNTER}     css:[data-testid="open-trades-counter"]
${WEBSOCKET_BADGE}         css:[data-testid="websocket-badge"]
${CTRADER_BADGE}           css:[data-testid="ctrader-badge"]
${LOGOUT_BTN}              css:[data-testid="logout-btn"]
${ACCOUNT_SELECTOR}        css:[data-testid="account-selector"]

# ── NAVIGATION TABS ───────────────────────────────────────────────
${TABS_NAV}                css:[data-testid="tabs-nav"]
${TAB_DASHBOARD}           css:[data-testid="tab-dashboard"]
${TAB_ANALYTICS}           css:[data-testid="tab-analytics"]
${TAB_BACKTEST}            css:[data-testid="tab-backtest"]
${TAB_JOURNAL}             css:[data-testid="tab-journal"]
${TAB_ACCOUNTS}            css:[data-testid="tab-accounts"]

# ── DASHBOARD ─────────────────────────────────────────────────────
${DASHBOARD}               css:[data-testid="dashboard"]
${TAB_CONTENT_DASHBOARD}   css:[data-testid="tab-content-dashboard"]
${AUTOMODE_WARNING}        css:[data-testid="automode-warning"]
${DRAWDOWN_PANEL}          css:[data-testid="drawdown-panel"]
${STRAT_AUTOMODES_PANEL}   css:[data-testid="strat-automodes-panel"]
${STATS_PANEL}             css:[data-testid="stats-panel"]
${STAT_BUY}                css:[data-testid="stat-buy"]
${STAT_SELL}               css:[data-testid="stat-sell"]
${STAT_LTF}                css:[data-testid="stat-ltf"]
${STAT_TOTAL}              css:[data-testid="stat-total"]

# ── FILTRES ───────────────────────────────────────────────────────
${FILTERS_PANEL}           css:[data-testid="filters-panel"]
${FILTER_ALL}              css:[data-testid="filter-all"]
${FILTER_SIGNAL}           css:[data-testid="filter-signal"]
${FILTER_LTF}              css:[data-testid="filter-ltf"]
${FILTER_BUY}              css:[data-testid="filter-buy"]
${FILTER_SELL}             css:[data-testid="filter-sell"]
${FILTER_TEST_BTN}         css:[data-testid="filter-test-btn"]

# ── PAIRES ────────────────────────────────────────────────────────
${PAIRS_GRID}              css:[data-testid="pairs-grid"]
${PAIRS_SECTION_TITLE}     css:[data-testid="pairs-section-title"]

# ── HISTORIQUE ────────────────────────────────────────────────────
${HISTORY_WRAP}            css:[data-testid="history-wrap"]
${HISTORY_TABLE}           css:[data-testid="history-table"]

# ── POSITIONS ─────────────────────────────────────────────────────
${POSITIONS_PANEL}         css:[data-testid="positions-panel"]
${POSITIONS_PANEL_EMPTY}   css:[data-testid="positions-panel-empty"]
${POSITIONS_COUNT}         css:[data-testid="positions-count"]
${POSITIONS_TABLE}         css:[data-testid="positions-table"]
${POSITIONS_REFRESH_BTN}   css:[data-testid="positions-refresh-btn"]

# ── ANALYTICS ─────────────────────────────────────────────────────
${ANALYTICS_PAGE}          css:[data-testid="analytics-page"]
${ANALYTICS_DAYS_SEL}      css:[data-testid="analytics-days-selector"]
${ANALYTICS_DAYS_7}        css:[data-testid="analytics-days-7"]
${ANALYTICS_DAYS_14}       css:[data-testid="analytics-days-14"]
${ANALYTICS_DAYS_30}       css:[data-testid="analytics-days-30"]
${ANALYTICS_DAYS_60}       css:[data-testid="analytics-days-60"]

# ── BACKTEST ──────────────────────────────────────────────────────
${BACKTEST_PAGE}           css:[data-testid="backtest-page"]
${BACKTEST_IMPORT_BTN}     css:[data-testid="backtest-import-btn"]
${BACKTEST_FILE_INPUT}     css:[data-testid="backtest-file-input"]
${BACKTEST_RESULTS}        css:[data-testid="backtest-results"]
${BACKTEST_ERROR}          css:[data-testid="backtest-error"]

# ── JOURNAL ───────────────────────────────────────────────────────
${JOURNAL_PAGE}            css:[data-testid="journal-page"]
${JOURNAL_EXPORT_CSV_BTN}  css:[data-testid="journal-export-csv-btn"]
${JOURNAL_TABLE}           css:[data-testid="journal-table"]
${JOURNAL_STATS}           css:[data-testid="journal-stats"]

# ── COMPTES ───────────────────────────────────────────────────────
${ACCOUNTS_PAGE}           css:[data-testid="accounts-page"]
${ACCOUNTS_ADD_BTN}        css:[data-testid="accounts-add-btn"]
${ACCOUNT_FORM}            css:[data-testid="account-form"]
${ACCOUNT_SUBMIT_BTN}      css:[data-testid="account-submit-btn"]
${ACCOUNT_MSG}             css:[data-testid="accounts-msg"]

# ── ORDER MODAL ───────────────────────────────────────────────────
${ORDER_MODAL}             css:[data-testid="order-modal"]
${ORDER_MODAL_OVERLAY}     css:[data-testid="order-modal-overlay"]
${ORDER_MODAL_TITLE}       css:[data-testid="order-modal-title"]
${ORDER_MODAL_CLOSE_BTN}   css:[data-testid="order-modal-close-btn"]
${ORDER_ENTRY_INPUT}       css:[data-testid="order-entry-input"]
${ORDER_LOTS_INPUT}        css:[data-testid="order-lots-input"]
${ORDER_SL_INPUT}          css:[data-testid="order-sl-input"]
${ORDER_TP_INPUT}          css:[data-testid="order-tp-input"]
${ORDER_RISK_PREVIEW}      css:[data-testid="order-risk-preview"]
${ORDER_RR}                css:[data-testid="order-rr"]
${ORDER_ERROR_MSG}         css:[data-testid="order-error-msg"]
${ORDER_CANCEL_BTN}        css:[data-testid="order-cancel-btn"]
${ORDER_CONFIRM_BTN}       css:[data-testid="order-confirm-btn"]
${ORDER_SUCCESS}           css:[data-testid="order-success"]
${ORDER_SUCCESS_CLOSE_BTN} css:[data-testid="order-success-close-btn"]
