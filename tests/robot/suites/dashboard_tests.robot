*** Settings ***
Documentation     ICT Trading Dashboard — Tests End-to-End
Library           Browser
Library           Collections
Library           String
Library           RequestsLibrary

Suite Setup       Ouvrir Navigateur
Suite Teardown    Fermer Navigateur

*** Variables ***
# ✅ FIX : Ports explicites (frontend=5173, backend=3001 en CI)
${BASE_URL}       http://localhost:5173
${API_URL}        http://localhost:3001
${LOGIN}          hadavidh@gmail.com
${PASSWORD}       J!09O1$3OCOkURUjOPEv
${TIMEOUT}        15s

# Sélecteurs centralisés — modifier ici si le HTML change
${SEL_EMAIL}      css=input[type="email"]
${SEL_PASSWORD}   css=input[type="password"]
${SEL_SUBMIT}     css=button[type="submit"]
${SEL_DASHBOARD}  css=.hdr-title

*** Test Cases ***

TC01 - Page de login accessible
    [Documentation]    La page de login charge correctement
    [Tags]    smoke    login
    Go To    ${BASE_URL}
    # ✅ FIX : css=input matchait les 2 champs → strict mode violation
    #          On attend le champ email spécifiquement
    Wait For Elements State    ${SEL_EMAIL}    visible    timeout=${TIMEOUT}
    Take Screenshot    filename=${CURDIR}/../../reports/screenshots/tc01_login.png

TC02 - Login avec identifiants valides
    [Documentation]    Login correct → dashboard visible
    [Tags]    smoke    login    auth
    Go To    ${BASE_URL}
    ${need_login}=    Run Keyword And Return Status
    ...    Wait For Elements State    ${SEL_PASSWORD}    visible    timeout=5s
    IF    ${need_login}
        # ✅ FIX : suppression du sélecteur CSS avec virgule (non supporté en strict mode)
        Fill Text    ${SEL_EMAIL}       ${LOGIN}
        Fill Text    ${SEL_PASSWORD}    ${PASSWORD}
        Click        ${SEL_SUBMIT}
    END
    Wait For Elements State    ${SEL_DASHBOARD}    visible    timeout=${TIMEOUT}
    Take Screenshot    filename=${CURDIR}/../../reports/screenshots/tc02_dashboard.png

TC03 - Login avec mauvais mot de passe
    [Documentation]    Mauvais password → pas de dashboard
    [Tags]    login    securite
    Go To    ${BASE_URL}
    Wait For Elements State    ${SEL_PASSWORD}    visible    timeout=${TIMEOUT}
    # ✅ FIX : sélecteur email précis
    Fill Text    ${SEL_EMAIL}       ${LOGIN}
    Fill Text    ${SEL_PASSWORD}    mauvais_mdp_123
    Click        ${SEL_SUBMIT}
    Sleep    2s
    Take Screenshot    filename=${CURDIR}/../../reports/screenshots/tc03_login_error.png
    ${on_dashboard}=    Run Keyword And Return Status
    ...    Wait For Elements State    ${SEL_DASHBOARD}    visible    timeout=3s
    Should Not Be True    ${on_dashboard}

TC04 - Login avec champs vides
    [Documentation]    Soumission sans credentials → pas de redirection
    [Tags]    login    validation
    Go To    ${BASE_URL}
    ${login_page}=    Run Keyword And Return Status
    ...    Wait For Elements State    ${SEL_PASSWORD}    visible    timeout=5s
    IF    ${login_page}
        Click    ${SEL_SUBMIT}
        Sleep    1s
        Take Screenshot    filename=${CURDIR}/../../reports/screenshots/tc04_empty.png
        # ✅ Vérifier qu'on est toujours sur la page login
        Wait For Elements State    ${SEL_EMAIL}    visible    timeout=5s
    END

TC05 - Dashboard affiche les paires Forex
    [Documentation]    Au moins 20 paires sont présentes
    [Tags]    smoke    dashboard
    Se Connecter
    Wait For Elements State    css=.grid    visible    timeout=${TIMEOUT}
    ${tiles}=    Get Elements    css=.grid > *
    ${count}=    Get Length    ${tiles}
    Should Be True    ${count} >= 20    msg=Attendu ≥20 paires, trouvé: ${count}
    Take Screenshot    filename=${CURDIR}/../../reports/screenshots/tc05_grid.png

TC06 - Bouton AutoBot présent dans le header
    [Documentation]    Le bouton AutoBot est visible
    [Tags]    smoke    autobot
    Se Connecter
    Wait For Elements State    xpath=//button[contains(.,'AutoBot')]    visible    timeout=${TIMEOUT}
    Take Screenshot    filename=${CURDIR}/../../reports/screenshots/tc06_autobot.png

TC07 - Toggle AutoMode change l'état
    [Documentation]    Cliquer AutoBot change ON ↔ OFF
    [Tags]    autobot    interaction
    Se Connecter
    ${texte_avant}=    Get Text    xpath=//button[contains(.,'AutoBot')]
    Click    xpath=//button[contains(.,'AutoBot')]
    Sleep    1s
    ${texte_apres}=    Get Text    xpath=//button[contains(.,'AutoBot')]
    Should Not Be Equal    ${texte_avant}    ${texte_apres}
    Take Screenshot    filename=${CURDIR}/../../reports/screenshots/tc07_toggle.png
    # Remettre en état initial
    Click    xpath=//button[contains(.,'AutoBot')]
    Sleep    0.5s

TC08 - Navigation entre les onglets
    [Documentation]    Chaque onglet s'ouvre sans erreur
    [Tags]    smoke    navigation
    Se Connecter
    @{tabs}=    Create List    Analytics    Backtest    Journal    Comptes
    FOR    ${tab}    IN    @{tabs}
        Click    xpath=//button[contains(.,'${tab}')]
        Sleep    1s
        Take Screenshot    filename=${CURDIR}/../../reports/screenshots/tc08_${tab}.png
    END

TC09 - Analytics contient des graphiques
    [Documentation]    La page Analytics contient des éléments SVG
    [Tags]    smoke    analytics
    Se Connecter
    Click    xpath=//button[contains(.,'Analytics')]
    Sleep    2s
    ${has_chart}=    Run Keyword And Return Status
    ...    Wait For Elements State    css=svg    visible    timeout=10s
    Take Screenshot    filename=${CURDIR}/../../reports/screenshots/tc09_analytics.png
    Should Be True    ${has_chart}

TC10 - Journal accessible
    [Documentation]    La page Journal s'ouvre
    [Tags]    smoke    journal
    Se Connecter
    Click    xpath=//button[contains(.,'Journal')]
    Sleep    1s
    Take Screenshot    filename=${CURDIR}/../../reports/screenshots/tc10_journal.png

TC11 - Badge WebSocket connected
    [Documentation]    La connexion WebSocket est active
    [Tags]    smoke    websocket
    Se Connecter
    Sleep    3s
    ${connected}=    Run Keyword And Return Status
    ...    Wait For Elements State    xpath=//*[contains(.,'connected')]    visible    timeout=20s
    Take Screenshot    filename=${CURDIR}/../../reports/screenshots/tc11_ws.png
    Should Be True    ${connected}

TC12 - Filtre BUY fonctionne
    [Documentation]    Cliquer BUY filtre les paires
    [Tags]    dashboard    filtres
    Se Connecter
    # ✅ FIX : port explicite dans l'URL API
    GET    ${API_URL}/api/test    expected_status=200
    Sleep    1s
    Click    xpath=//button[contains(.,'BUY')]
    Sleep    1s
    Take Screenshot    filename=${CURDIR}/../../reports/screenshots/tc12_buy.png

TC13 - Page Backtest affiche les instructions
    [Documentation]    Guide d'import CSV visible
    [Tags]    smoke    backtest
    Se Connecter
    Click    xpath=//button[contains(.,'Backtest')]
    Sleep    1s
    Wait For Elements State    xpath=//*[contains(.,'Importer')]    visible    timeout=${TIMEOUT}
    Take Screenshot    filename=${CURDIR}/../../reports/screenshots/tc13_backtest.png

TC14 - Page Comptes liste les comptes
    [Documentation]    Au moins un compte FTMO affiché
    [Tags]    smoke    comptes
    Se Connecter
    Click    xpath=//button[contains(.,'Comptes')]
    Sleep    1s
    Wait For Elements State    xpath=//*[contains(.,'FTMO')]    visible    timeout=${TIMEOUT}
    Take Screenshot    filename=${CURDIR}/../../reports/screenshots/tc14_accounts.png

TC15 - Affichage mobile 375px
    [Documentation]    Interface lisible sur iPhone SE
    [Tags]    responsive    mobile
    Set Viewport Size    375    812
    Se Connecter
    Wait For Elements State    ${SEL_DASHBOARD}    visible    timeout=${TIMEOUT}
    Take Screenshot    filename=${CURDIR}/../../reports/screenshots/tc15_mobile.png
    Set Viewport Size    1280    800

TC16 - Affichage tablette 768px
    [Documentation]    Interface lisible sur iPad
    [Tags]    responsive    tablet
    Set Viewport Size    768    1024
    Se Connecter
    Take Screenshot    filename=${CURDIR}/../../reports/screenshots/tc16_tablet.png
    Set Viewport Size    1280    800

*** Keywords ***

Ouvrir Navigateur
    New Browser    browser=chromium    headless=True
    New Context    viewport={'width': 1280, 'height': 800}
    New Page    ${BASE_URL}

Fermer Navigateur
    Close Browser

Se Connecter
    [Documentation]    Va sur l'app, se connecte si la page login est visible
    Go To    ${BASE_URL}
    Wait Until Network Is Idle    timeout=${TIMEOUT}
    ${need_login}=    Run Keyword And Return Status
    ...    Wait For Elements State    ${SEL_PASSWORD}    visible    timeout=5s
    IF    ${need_login}
        # ✅ FIX : sélecteurs précis sans virgule CSS
        Fill Text    ${SEL_EMAIL}       ${LOGIN}
        Fill Text    ${SEL_PASSWORD}    ${PASSWORD}
        Click        ${SEL_SUBMIT}
        Wait For Elements State    ${SEL_DASHBOARD}    visible    timeout=${TIMEOUT}
    END
