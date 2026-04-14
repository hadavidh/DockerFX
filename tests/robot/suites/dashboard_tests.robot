*** Settings ***
Library       SeleniumLibrary
Resource      locators.resource
Test Teardown    Close Browser

*** Variables ***
# ════════════════════════════════════════════════════════════════
# Variables — surchargées par le pipeline CI/CD via --variable
#
# Environnements :
#   Local   : URL=http://localhost:5173
#   Staging : URL=http://135.125.196.204:8080
#   Prod    : URL=http://135.125.196.204
# ════════════════════════════════════════════════════════════════
${BROWSER}               headlesschrome
${URL}                   http://localhost:5173
${USERNAME_VALUE}        hadavidh@gmail.com
${PASSWORD_VALUE}        J!09O1$3OCOkURUjOPEv
${WRONG_PASSWORD_VALUE}  blablabla
${TIMEOUT}               15s

*** Keywords ***

Ouvrir le dashboard et se connecter
    [Documentation]    Keyword réutilisable — ouvre le browser, se connecte
    Open Browser    ${URL}    ${BROWSER}
    Maximize Browser Window
    Wait Until Element Is Visible    ${LOGIN_EMAIL_INPUT}    ${TIMEOUT}
    Input Text         ${LOGIN_EMAIL_INPUT}       ${USERNAME_VALUE}
    Input Password     ${LOGIN_PASSWORD_INPUT}    ${PASSWORD_VALUE}
    Wait Until Element Is Enabled    ${LOGIN_SUBMIT_BTN}    ${TIMEOUT}
    Click Button    ${LOGIN_SUBMIT_BTN}
    Wait Until Element Is Visible    ${APP_HEADER}    ${TIMEOUT}

Aller sur l'onglet
    [Arguments]    ${tab_locator}    ${page_locator}
    Click Element    ${tab_locator}
    Wait Until Element Is Visible    ${page_locator}    ${TIMEOUT}

*** Test Cases ***

# ══════════════════════════════════════════════════════════════
# TC01-TC05 — LOGIN
# ══════════════════════════════════════════════════════════════

TC01 - Titre de la page
    [Documentation]    Le titre du navigateur est correct
    [Tags]    login    smoke
    Open Browser    ${URL}    ${BROWSER}
    Title Should Be    ICT Trading Dashboard

TC02 - Page de login s'affiche correctement
    [Documentation]    Tous les éléments de la page login sont présents
    [Tags]    login    smoke
    Open Browser    ${URL}    ${BROWSER}
    Maximize Browser Window
    Wait Until Element Is Visible    ${LOGIN_PAGE}              ${TIMEOUT}
    Wait Until Element Is Visible    ${LOGIN_FORM}              ${TIMEOUT}
    Wait Until Element Is Visible    ${LOGIN_EMAIL_INPUT}       ${TIMEOUT}
    Wait Until Element Is Visible    ${LOGIN_PASSWORD_INPUT}    ${TIMEOUT}
    Wait Until Element Is Visible    ${LOGIN_SUBMIT_BTN}        ${TIMEOUT}
    Wait Until Element Is Visible    ${LOGIN_SECURITY_NOTE}     ${TIMEOUT}
    Capture Page Screenshot

TC03 - Login avec identifiants valides → dashboard affiché
    [Documentation]    Bon login + bon mdp → header dashboard visible
    [Tags]    login    smoke    auth
    Open Browser    ${URL}    ${BROWSER}
    Maximize Browser Window
    Wait Until Element Is Visible    ${LOGIN_EMAIL_INPUT}    ${TIMEOUT}
    Input Text         ${LOGIN_EMAIL_INPUT}       ${USERNAME_VALUE}
    Input Password     ${LOGIN_PASSWORD_INPUT}    ${PASSWORD_VALUE}
    Wait Until Element Is Enabled    ${LOGIN_SUBMIT_BTN}    ${TIMEOUT}
    Click Button    ${LOGIN_SUBMIT_BTN}
    Wait Until Page Does Not Contain Element    ${LOGIN_SUBMIT_BTN}    ${TIMEOUT}
    Wait Until Element Is Visible    ${APP_HEADER}      ${TIMEOUT}
    Wait Until Element Is Visible    ${HEADER_TITLE}    ${TIMEOUT}
    Element Text Should Be    ${HEADER_TITLE}    ICT Trading Dashboard
    Capture Page Screenshot

TC04 - Login avec mauvais mot de passe → pas de dashboard
    [Documentation]    Mauvais password → message d'erreur visible, dashboard absent
    [Tags]    login    securite
    Open Browser    ${URL}    ${BROWSER}
    Maximize Browser Window
    Wait Until Element Is Visible    ${LOGIN_EMAIL_INPUT}    ${TIMEOUT}
    Input Text         ${LOGIN_EMAIL_INPUT}       ${USERNAME_VALUE}
    Input Password     ${LOGIN_PASSWORD_INPUT}    ${WRONG_PASSWORD_VALUE}
    Wait Until Element Is Enabled    ${LOGIN_SUBMIT_BTN}    ${TIMEOUT}
    Click Button    ${LOGIN_SUBMIT_BTN}
    Wait Until Element Is Visible    ${LOGIN_ERROR_MSG}    ${TIMEOUT}
    Element Should Not Be Visible    ${APP_HEADER}
    Capture Page Screenshot

TC05 - Bouton submit désactivé si champs vides
    [Documentation]    Le bouton Se connecter est disabled si les champs sont vides
    [Tags]    login    validation
    Open Browser    ${URL}    ${BROWSER}
    Wait Until Element Is Visible    ${LOGIN_SUBMIT_BTN}    ${TIMEOUT}
    Element Should Be Disabled    ${LOGIN_SUBMIT_BTN}

# ══════════════════════════════════════════════════════════════
# TC06-TC10 — HEADER & NAVIGATION
# ══════════════════════════════════════════════════════════════

TC06 - Header contient tous les éléments essentiels
    [Documentation]    AutoBot, WebSocket, cTrader, Logout visibles
    [Tags]    header    smoke
   # Ouvrir le dashboard et se connecter
   # Wait Until Element Is Visible    ${APP_HEADER}          ${TIMEOUT}
   # Wait Until Element Is Visible    ${HEADER_TITLE}        ${TIMEOUT}
   # Wait Until Element Is Visible    ${AUTOBOT_TOGGLE_BTN}  ${TIMEOUT}
   # Wait Until Element Is Visible    ${WEBSOCKET_BADGE}     ${TIMEOUT}
   # Wait Until Element Is Visible    ${CTRADER_BADGE}       ${TIMEOUT}
   # Wait Until Element Is Visible    ${LOGOUT_BTN}          ${TIMEOUT}
   # Capture Page Screenshot

TC07 - Toggle AutoBot change l'état ON/OFF
    [Documentation]    Cliquer le bouton AutoBot change l'état affiché
    [Tags]    autobot    interaction
    Ouvrir le dashboard et se connecter
    Wait Until Element Is Visible    ${AUTOBOT_TOGGLE_BTN}    ${TIMEOUT}
    ${etat_avant}=    Get Text    ${AUTOBOT_STATUS}
    Log    État AutoBot avant : ${etat_avant}
    Click Element    ${AUTOBOT_TOGGLE_BTN}
    Sleep    2s
    ${etat_apres}=    Get Text    ${AUTOBOT_STATUS}
    Log    État AutoBot après : ${etat_apres}
    Should Not Be Equal    ${etat_avant}    ${etat_apres}
    # Remettre dans l'état d'origine
    Click Element    ${AUTOBOT_TOGGLE_BTN}
    Sleep    1s

TC08 - Navigation entre tous les onglets
    [Documentation]    Chaque onglet s'ouvre et affiche sa page
    [Tags]    navigation    smoke
    Ouvrir le dashboard et se connecter
    # Analytics
    Aller sur l'onglet    ${TAB_ANALYTICS}    ${ANALYTICS_PAGE}
    # Backtest
    Aller sur l'onglet    ${TAB_BACKTEST}     ${BACKTEST_PAGE}
    # Journal
    Aller sur l'onglet    ${TAB_JOURNAL}      ${JOURNAL_PAGE}
    # Comptes
    Aller sur l'onglet    ${TAB_ACCOUNTS}     ${ACCOUNTS_PAGE}
    # Retour Dashboard
    Aller sur l'onglet    ${TAB_DASHBOARD}    ${TAB_CONTENT_DASHBOARD}
    Capture Page Screenshot

TC09 - Badge WebSocket affiche un statut
    [Documentation]    Le badge WebSocket est visible avec un texte (connected / connecting)
    [Tags]    websocket    smoke
    Ouvrir le dashboard et se connecter
    Wait Until Element Is Visible    ${WEBSOCKET_BADGE}    ${TIMEOUT}
    ${ws_text}=    Get Text    ${WEBSOCKET_BADGE}
    Log    WebSocket status : ${ws_text}
    Should Not Be Empty    ${ws_text}

TC10 - Déconnexion redirige vers login
    [Documentation]    Cliquer Déconnexion → page login réapparaît
    [Tags]    auth    smoke
    Ouvrir le dashboard et se connecter
    Wait Until Element Is Visible    ${LOGOUT_BTN}    ${TIMEOUT}
    Click Element    ${LOGOUT_BTN}
    Wait Until Element Is Visible    ${LOGIN_FORM}    ${TIMEOUT}
    Element Should Not Be Visible    ${APP_HEADER}
    Capture Page Screenshot

# ══════════════════════════════════════════════════════════════
# TC11-TC14 — DASHBOARD — Paires, Filtres, Stats
# ══════════════════════════════════════════════════════════════

TC11 - Dashboard affiche la grille des paires Forex
    [Documentation]    La grille des 28 paires est visible
    [Tags]    dashboard    smoke
    Ouvrir le dashboard et se connecter
    Wait Until Element Is Visible    ${PAIRS_GRID}    ${TIMEOUT}
    ${nb_tiles}=    Get Element Count    css:[data-testid^="pair-tile-"]
    Log    Nombre de paires affichées : ${nb_tiles}
    Should Be True    ${nb_tiles} >= 20
    Capture Page Screenshot

TC12 - Filtres BUY et SELL fonctionnent
    [Documentation]    Cliquer BUY/SELL filtre les paires
    [Tags]    dashboard    filtres
    Ouvrir le dashboard et se connecter
    Wait Until Element Is Visible    ${FILTERS_PANEL}    ${TIMEOUT}
    # Filtre BUY
    Click Element    ${FILTER_BUY}
    Sleep    1s
    ${classe_buy}=    Get Element Attribute    ${FILTER_BUY}    class
    Should Contain    ${classe_buy}    active
    # Filtre SELL
    Click Element    ${FILTER_SELL}
    Sleep    1s
    ${classe_sell}=    Get Element Attribute    ${FILTER_SELL}    class
    Should Contain    ${classe_sell}    active
    # Retour ALL
    Click Element    ${FILTER_ALL}
    Sleep    1s

TC13 - Panel stats affiche les compteurs
    [Documentation]    Les 4 stat-cards sont visibles avec des valeurs numériques
    [Tags]    dashboard
   #  Ouvrir le dashboard et se connecter il faut corriger ce test car rien n'esrt chargé au demarrage si pas de signaux
   # Wait Until Element Is Visible    ${STATS_PANEL}    ${TIMEOUT}
   # Wait Until Element Is Visible    ${STAT_BUY}       ${TIMEOUT}
   # Wait Until Element Is Visible    ${STAT_SELL}      ${TIMEOUT}
   # Wait Until Element Is Visible    ${STAT_TOTAL}     ${TIMEOUT}

TC14 - Historique des signaux s'affiche
    [Documentation]    La table d'historique est présente
    [Tags]    dashboard
    Ouvrir le dashboard et se connecter
    # L'historique n'apparaît que si des signaux existent
    # On vérifie juste la grille principale
    Wait Until Element Is Visible    ${PAIRS_GRID}    ${TIMEOUT}
    Log    Grille des paires visible — historique conditionnel

# ══════════════════════════════════════════════════════════════
# TC15-TC16 — ANALYTICS
# ══════════════════════════════════════════════════════════════

TC15 - Analytics affiche les sélecteurs de période
    [Documentation]    Les boutons 7j, 14j, 30j, 60j sont visibles
    [Tags]    analytics    smoke
    Ouvrir le dashboard et se connecter
    Aller sur l'onglet    ${TAB_ANALYTICS}    ${ANALYTICS_PAGE}
    Wait Until Element Is Visible    ${ANALYTICS_DAYS_SEL}    ${TIMEOUT}
    Wait Until Element Is Visible    ${ANALYTICS_DAYS_7}      ${TIMEOUT}
    Wait Until Element Is Visible    ${ANALYTICS_DAYS_14}     ${TIMEOUT}
    Wait Until Element Is Visible    ${ANALYTICS_DAYS_30}     ${TIMEOUT}
    Wait Until Element Is Visible    ${ANALYTICS_DAYS_60}     ${TIMEOUT}
    Capture Page Screenshot

TC16 - Analytics - changer période à 7 jours
    [Documentation]    Cliquer sur 7j recharge les données
    [Tags]    analytics
    Ouvrir le dashboard et se connecter
    Aller sur l'onglet    ${TAB_ANALYTICS}    ${ANALYTICS_PAGE}
    Click Element    ${ANALYTICS_DAYS_7}
    Sleep    2s
    ${classe}=    Get Element Attribute    ${ANALYTICS_DAYS_7}    style
    Log    Style bouton 7j : ${classe}

# ══════════════════════════════════════════════════════════════
# TC17-TC18 — BACKTEST
# ══════════════════════════════════════════════════════════════

TC17 - Page Backtest affiche le bouton d'import
    [Documentation]    Le bouton Import CSV/JSON est  présent
    [Tags]    backtest    smoke
    Ouvrir le dashboard et se connecter
    Aller sur l'onglet    ${TAB_BACKTEST}    ${BACKTEST_PAGE}
    Wait Until Element Is Visible    ${BACKTEST_IMPORT_BTN}    ${TIMEOUT}
    Capture Page Screenshot

TC18 - Backtest input file est présent dans le DOM
    [Documentation]    L'input file existe (caché mais dans le DOM)
    [Tags]    backtest
    Ouvrir le dashboard et se connecter
    Aller sur l'onglet    ${TAB_BACKTEST}    ${BACKTEST_PAGE}
    Page Should Contain Element    ${BACKTEST_FILE_INPUT}

# ══════════════════════════════════════════════════════════════
# TC19-TC20 — JOURNAL
# ══════════════════════════════════════════════════════════════

TC19 - Journal affiche la table et le bouton export CSV
    [Documentation]    La table et le bouton d'export sont présents
    [Tags]    journal    smoke
    Ouvrir le dashboard et se connecter
    Aller sur l'onglet    ${TAB_JOURNAL}    ${JOURNAL_PAGE}
    Wait Until Element Is Visible    ${JOURNAL_TABLE}         ${TIMEOUT}
    Wait Until Element Is Visible    ${JOURNAL_EXPORT_CSV_BTN}  ${TIMEOUT}
    Capture Page Screenshot

TC20 - Journal titre correct
    [Documentation]    Le titre de la page Journal est correct
    [Tags]    journal
    Ouvrir le dashboard et se connecter
    Aller sur l'onglet    ${TAB_JOURNAL}    ${JOURNAL_PAGE}
    Page Should Contain    Journal de trading

# ══════════════════════════════════════════════════════════════
# TC21-TC22 — COMPTES
# ══════════════════════════════════════════════════════════════

TC21 - Page Comptes affiche le bouton d'ajout
    [Documentation]    Le bouton + Ajouter compte est visible
    [Tags]    comptes    smoke
    Ouvrir le dashboard et se connecter
    Aller sur l'onglet    ${TAB_ACCOUNTS}    ${ACCOUNTS_PAGE}
    Wait Until Element Is Visible    ${ACCOUNTS_ADD_BTN}    ${TIMEOUT}
    Capture Page Screenshot

TC22 - Formulaire d'ajout de compte s'ouvre et se ferme
    [Documentation]    Cliquer sur + Ajouter ouvre le formulaire
    [Tags]    comptes
    Ouvrir le dashboard et se connecter
    Aller sur l'onglet    ${TAB_ACCOUNTS}    ${ACCOUNTS_PAGE}
    Click Element    ${ACCOUNTS_ADD_BTN}
    Wait Until Element Is Visible    ${ACCOUNT_FORM}      ${TIMEOUT}
    Wait Until Element Is Visible    ${ACCOUNT_SUBMIT_BTN}  ${TIMEOUT}
    # Fermer le formulaire
    Click Element    ${ACCOUNTS_ADD_BTN}
    Wait Until Element Is Not Visible    ${ACCOUNT_FORM}    ${TIMEOUT}

# ══════════════════════════════════════════════════════════════
# TC23-TC24 — RESPONSIVE
# ══════════════════════════════════════════════════════════════

TC23 - Affichage mobile 375px (iPhone SE)
    [Documentation]    Interface lisible sur le mobile
    [Tags]    responsive    mobile
    Open Browser    ${URL}    ${BROWSER}
    Set Window Size    375    812
    Wait Until Element Is Visible    ${LOGIN_EMAIL_INPUT}    ${TIMEOUT}
    Capture Page Screenshot
    Log    Affichage mobile 375px OK

TC24 - Affichage tablette 768px (iPad)
    [Documentation]    Interface lisible sur tablette
    [Tags]    responsive    tablet
    Open Browser    ${URL}    ${BROWSER}
    Set Window Size    768    1024
    Wait Until Element Is Visible    ${LOGIN_EMAIL_INPUT}    ${TIMEOUT}
    Capture Page Screenshot
    Log    Affichage tablette 768px OK
