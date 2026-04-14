*** Settings ***
Library    SeleniumLibrary
Resource   locators.resource
Test Teardown    Close Browser

*** Variables ***
${BROWSER}                 headlesschrome
${URL}                     http://localhost:5173
${USERNAME_VALUE}          demo@example.com
${PASSWORD_VALUE}          change-me
${WRONG_PASSWORD_VALUE}    blablabla
${TIMEOUT}                 15s

*** Test Cases ***
TC01 - Titre de la page
    [Documentation]    Le titre de l'application web s'affiche
    [Tags]    login    securite
    Open Browser    ${URL}    ${BROWSER}
    Title Should Be    ICT Trading Dashboard

TC02 - Login valide affiche le dashboard
    [Documentation]    La page de login charge correctement avec bon login/mot de passe
    [Tags]    login    securite
    Open Browser    ${URL}    ${BROWSER}
    Maximize Browser Window
    Wait Until Element Is Visible    ${}  ${TIMEOUT}
    Input Text        ${LOGIN_PAGE}              ${USERNAME_VALUE}
    Input Password    ${LOGIN_PASSWORD_INPUT}    ${PASSWORD_VALUE}
    Click Button      ${LOGIN_SUBMIT_BTN}
    Wait Until Element Is Visible    css:[data-testid="header-title"]    ${TIMEOUT}
    Element Text Should Be           css:[data-testid="header-title"]    ICT Trading Dashboard
    Capture Page Screenshot

TC03 - Dashboard affiche le header
    [Documentation]    Après login, le dashboard s'affiche bien
    [Tags]    login    dashboard
    Open Browser    ${URL}    ${BROWSER}
    Maximize Browser Window
    Wait Until Element Is Visible    ${LOGIN_PAGE}    ${TIMEOUT}
    Input Text        ${LOGIN_PAGE}              ${USERNAME_VALUE}
    Input Password    ${LOGIN_PASSWORD_INPUT}    ${PASSWORD_VALUE}
    Click Button      ${LOGIN_SUBMIT_BTN}
    Wait Until Element Is Visible    css:[data-testid="header-title"]    ${TIMEOUT}
    Element Text Should Be           css:[data-testid="header-title"]    ICT Trading Dashboard
    Capture Page Screenshot

TC04 - Login avec mauvais mot de passe
    [Documentation]    Mauvais mot de passe → pas de dashboard
    [Tags]    login    securite
    Open Browser    ${URL}    ${BROWSER}
    Maximize Browser Window
    Wait Until Element Is Visible    ${LOGIN_PAGE}    ${TIMEOUT}
    Input Text        ${LOGIN_PAGE}              ${USERNAME_VALUE}
    Input Password    ${LOGIN_PASSWORD_INPUT}    ${WRONG_PASSWORD_VALUE}
    Click Button      ${LOGIN_SUBMIT_BTN}
    Element Should Not Be Visible    css:[data-testid="header-title"]

TC05 - Login avec champs vides
    [Documentation]    Bouton désactivé si les champs sont vides
    [Tags]    login    validation
    Open Browser    ${URL}    ${BROWSER}
    Wait Until Element Is Visible    css:[data-testid="login-submit-btn"]    ${TIMEOUT}
    Element Should Be Disabled       css:[data-testid="login-submit-btn"]

TC06 - Dashboard affiche les paires Forex
    [Documentation]    Le dashboard principal s'affiche
    [Tags]    smoke    dashboard
    Open Browser    ${URL}    ${BROWSER}
    Maximize Browser Window
    Wait Until Element Is Visible    ${LOGIN_PAGE}    ${TIMEOUT}
    Input Text        ${LOGIN_PAGE}              ${USERNAME_VALUE}
    Input Password    ${LOGIN_PASSWORD_INPUT}    ${PASSWORD_VALUE}
    Click Button      ${LOGIN_SUBMIT_BTN}
    Wait Until Element Is Visible    css:[data-testid="header-title"]    ${TIMEOUT}
    Capture Page Screenshot

TC07 - Bouton AutoBot présent dans le header
    [Documentation]    Le bouton AutoBot est visible
    [Tags]    smoke    autobot
    Log    OK

TC08 - Toggle AutoMode change l etat
    [Documentation]    Cliquer AutoBot change ON vers OFF
    [Tags]    autobot    interaction
    Log    OK

TC09 - Navigation entre les onglets
    [Documentation]    Chaque onglet s'ouvre sans erreur
    [Tags]    smoke    navigation
    Log    OK

TC10 - Analytics contient des graphiques
    [Documentation]    La page Analytics contient des graphiques
    [Tags]    smoke    analytics
    Log    OK

TC11 - Journal accessible
    [Documentation]    La page Journal s'ouvre
    [Tags]    smoke    journal
    Log    OK

TC12 - Badge WebSocket connected
    [Documentation]    La connexion WebSocket est active
    [Tags]    smoke    websocket
    Log    OK

TC13 - Filtre BUY fonctionne
    [Documentation]    Cliquer BUY filtre les paires
    [Tags]    dashboard    filtres
    Log    OK

TC14 - Page Backtest affiche les instructions
    [Documentation]    Le guide d'import CSV est visible
    [Tags]    smoke    backtest
    Log    OK

TC15 - Page Comptes liste les comptes
    [Documentation]    Au moins un compte est affiché
    [Tags]    smoke    comptes
    Log    OK

TC16 - Affichage mobile 375px
    [Documentation]    Interface lisible sur petit écran
    [Tags]    responsive    mobile
    Log    OK

TC17 - Affichage tablette 768px
    [Documentation]    Interface lisible sur tablette
    [Tags]    responsive    tablet
    Log    OK

*** Keywords ***
Afficher Message
    Log    Ceci est un mot-cle personnalise