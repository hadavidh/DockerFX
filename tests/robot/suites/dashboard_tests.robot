*** Settings ***
Documentation     ICT Trading Dashboard — Tests End-to-End
Library           Browser
Library           Collections
Library           String
Library           RequestsLibrary

Suite Setup       Ouvrir Navigateur
Suite Teardown    Fermer Navigateur

*** Variables ***
${BASE_URL}       http://localhost
${API_URL}        http://localhost
${LOGIN}          hadavidh@gmail.com
${PASSWORD}       motdepasse
${TIMEOUT}        20s
${SCREENSHOT}     ${CURDIR}/../../reports/screenshots

*** Test Cases ***

TC01 - Page de login accessible
    [Documentation]    La page de login charge correctement
    [Tags]    smoke    login
    Go To    ${BASE_URL}
    Wait For Elements State    css=input    visible    timeout=${TIMEOUT}
    Take Screenshot    filename=${SCREENSHOT}/tc01_login.png

TC02 - Login avec identifiants valides
    [Documentation]    Login correct → dashboard visible
    [Tags]    smoke    login    auth
    Go To    ${BASE_URL}
    ${need_login}=    Run Keyword And Return Status
    ...    Wait For Elements State    css=input[type="password"]    visible    timeout=5s
    IF    ${need_login}
        Remplir Et Soumettre Login    ${LOGIN}    ${PASSWORD}
    END
    Wait For Elements State    css=.hdr-title    visible    timeout=${TIMEOUT}
    Take Screenshot    filename=${SCREENSHOT}/tc02_dashboard.png

TC03 - Login avec mauvais mot de passe
    [Documentation]    Mauvais password → pas de dashboard
    [Tags]    login    securite
    Go To    ${BASE_URL}
    Wait For Elements State    css=input[type="password"]    visible    timeout=${TIMEOUT}
    Remplir Et Soumettre Login    ${LOGIN}    mauvais_mdp_123
    Sleep    2s
    Take Screenshot    filename=${SCREENSHOT}/tc03_login_error.png
    ${on_dashboard}=    Run Keyword And Return Status
    ...    Wait For Elements State    css=.hdr-title    visible    timeout=3s
    Should Not Be True    ${on_dashboard}    msg=Dashboard ne devrait pas s'afficher

TC04 - Login avec champs vides
    [Documentation]    Bouton désactivé si champs vides
    [Tags]    login    validation
    Go To    ${BASE_URL}
    ${login_page}=    Run Keyword And Return Status
    ...    Wait For Elements State    css=input[type="password"]    visible    timeout=5s
    IF    ${login_page}
        # Vérifier que le bouton est bien désactivé quand les champs sont vides
        Wait For Elements State    css=button[type="submit"]    disabled    timeout=5s
        Take Screenshot    filename=${SCREENSHOT}/tc04_btn_disabled.png
    ELSE
        Log    Déjà connecté — test ignoré    WARN
    END

TC05 - Dashboard affiche les paires Forex
    [Documentation]    Au moins 20 paires sont présentes
    [Tags]    smoke    dashboard
    Se Connecter
    Wait For Elements State    css=.grid    visible    timeout=${TIMEOUT}
    ${tiles}=    Get Elements    css=.grid > *
    ${count}=    Get Length    ${tiles}
    Should Be True    ${count} >= 20    msg=Attendu ≥20 paires, trouvé: ${count}
    Take Screenshot    filename=${SCREENSHOT}/tc05_grid.png

TC06 - Bouton AutoBot présent dans le header
    [Documentation]    Le bouton AutoBot est visible
    [Tags]    smoke    autobot
    Se Connecter
    Wait For Elements State    xpath=//button[contains(.,'AutoBot')]    visible    timeout=${TIMEOUT}
    Take Screenshot    filename=${SCREENSHOT}/tc06_autobot.png

TC07 - Toggle AutoMode change l état
    [Documentation]    Cliquer AutoBot change ON vers OFF
    [Tags]    autobot    interaction
    Se Connecter
    ${texte_avant}=    Get Text    xpath=//button[contains(.,'AutoBot')]
    Click    xpath=//button[contains(.,'AutoBot')]
    Sleep    1s
    ${texte_apres}=    Get Text    xpath=//button[contains(.,'AutoBot')]
    Should Not Be Equal    ${texte_avant}    ${texte_apres}
    Take Screenshot    filename=${SCREENSHOT}/tc07_toggle.png
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
        Take Screenshot    filename=${SCREENSHOT}/tc08_${tab}.png
    END

TC09 - Analytics contient des graphiques
    [Documentation]    La page Analytics contient des SVG recharts
    [Tags]    smoke    analytics
    Se Connecter
    Click    xpath=//button[contains(.,'Analytics')]
    Sleep    2s
    ${has_chart}=    Run Keyword And Return Status
    ...    Wait For Elements State    css=svg    visible    timeout=10s
    Take Screenshot    filename=${SCREENSHOT}/tc09_analytics.png
    Should Be True    ${has_chart}

TC10 - Journal accessible
    [Documentation]    La page Journal s'ouvre
    [Tags]    smoke    journal
    Se Connecter
    Click    xpath=//button[contains(.,'Journal')]
    Sleep    1s
    Take Screenshot    filename=${SCREENSHOT}/tc10_journal.png

TC11 - Badge WebSocket connected
    [Documentation]    La connexion WebSocket est active
    [Tags]    smoke    websocket
    Se Connecter
    Sleep    3s
    ${connected}=    Run Keyword And Return Status
    ...    Wait For Elements State    xpath=//*[contains(.,'connected')]    visible    timeout=20s
    Take Screenshot    filename=${SCREENSHOT}/tc11_ws.png
    Should Be True    ${connected}

TC12 - Filtre BUY fonctionne
    [Documentation]    Cliquer BUY filtre les paires
    [Tags]    dashboard    filtres
    Se Connecter
    GET    ${API_URL}/api/test    expected_status=200
    Sleep    1s
    Click    xpath=//button[contains(.,'BUY')]
    Sleep    1s
    Take Screenshot    filename=${SCREENSHOT}/tc12_buy.png

TC13 - Page Backtest affiche les instructions
    [Documentation]    Guide d'import CSV visible
    [Tags]    smoke    backtest
    Se Connecter
    Click    xpath=//button[contains(.,'Backtest')]
    Sleep    1s
    Wait For Elements State    xpath=//*[contains(.,'Importer')]    visible    timeout=${TIMEOUT}
    Take Screenshot    filename=${SCREENSHOT}/tc13_backtest.png

TC14 - Page Comptes liste les comptes
    [Documentation]    Au moins un compte FTMO affiché
    [Tags]    smoke    comptes
    Se Connecter
    Click    xpath=//button[contains(.,'Comptes')]
    Sleep    1s
    Wait For Elements State    xpath=//*[contains(.,'FTMO')]    visible    timeout=${TIMEOUT}
    Take Screenshot    filename=${SCREENSHOT}/tc14_accounts.png

TC15 - Affichage mobile 375px
    [Documentation]    Interface lisible sur iPhone SE
    [Tags]    responsive    mobile
    Set Viewport Size    375    812
    Se Connecter
    Wait For Elements State    css=.hdr-title    visible    timeout=${TIMEOUT}
    Take Screenshot    filename=${SCREENSHOT}/tc15_mobile.png
    Set Viewport Size    1280    800

TC16 - Affichage tablette 768px
    [Documentation]    Interface lisible sur iPad
    [Tags]    responsive    tablet
    Set Viewport Size    768    1024
    Se Connecter
    Take Screenshot    filename=${SCREENSHOT}/tc16_tablet.png
    Set Viewport Size    1280    800

*** Keywords ***

Ouvrir Navigateur
    New Browser    browser=chromium    headless=True
    New Context    viewport={'width': 1280, 'height': 800}
    New Page    ${BASE_URL}

Fermer Navigateur
    Close Browser

Remplir Et Soumettre Login
    [Documentation]    Remplit email + password puis attend que le bouton soit actif
    [Arguments]    ${email}    ${password}
    # Vider les champs d'abord
    Fill Text    css=input[type="email"], input[type="text"]    ${EMPTY}
    Fill Text    css=input[type="password"]    ${EMPTY}
    # Remplir email
    Click    css=input[type="email"], input[type="text"]
    Keyboard Input    type    ${email}
    # Remplir password
    Click    css=input[type="password"]
    Keyboard Input    type    ${password}
    # Attendre que le bouton soit enabled (plus disabled)
    Wait For Elements State
    ...    css=button[type="submit"]
    ...    enabled
    ...    timeout=5s
    # Cliquer
    Click    css=button[type="submit"]

Se Connecter
    Go To    ${BASE_URL}
    Wait Until Network Is Idle    timeout=${TIMEOUT}
    ${need_login}=    Run Keyword And Return Status
    ...    Wait For Elements State    css=input[type="password"]    visible    timeout=5s
    IF    ${need_login}
        Remplir Et Soumettre Login    ${LOGIN}    ${PASSWORD}
        Wait For Elements State    css=.hdr-title    visible    timeout=${TIMEOUT}
    END
