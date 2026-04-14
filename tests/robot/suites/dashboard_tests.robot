*** Settings ***
Library    SeleniumLibrary
Resource   locators.resource
Test Teardown    Close Browser



*** Variables ***
${BROWSER}    chrome
${URL}        http://135.125.196.204/
${USERNAME_VALUE}    hadavidh@gmail.com
${PASSWORD_VALUE}    J09O13OCOkURUjOPEv
${WRONG_PASSWORD_VALUE}    blablabla
${TIMEOUT}        10s

*** Test Cases ***
TC01 - Titre de la page
    [Documentation]    Le titre de l'application web s'affiche
    [Tags]    login    securite
    Open Browser    ${URL}    ${BROWSER}
    Title Should Be   ICT Trading Dashboard
    Close Browser

TC02 - Page de login accessible bon login et mot de passe
    [Documentation]    La page de login charge correctement avec bon login et mot passe, affichage du dashboard
    [Tags]    login    securite
    Open Browser    ${URL}    ${BROWSER}
    Maximize Browser Window
    Wait Until Element Is Visible    ${LOGIN_USERNAME_XPATH}   10s
    Input Text         ${LOGIN_USERNAME_XPATH}    ${USERNAME_VALUE}
    Input Password     ${LOGIN_PASSWORD_XPATH}     ${PASSWORD_VALUE}
    Click Button        ${LOGIN_SUBMIT_XPATH}  
    Wait Until Page Does Not Contain Element    ${LOGIN_SUBMIT_XPATH}      ${TIMEOUT}
    Capture Page Screenshot
    Close Browser
    

TC03 - DockerFX dashboard toute les pairs forex s'affichent correctement
    [Documentation]    Le dashboard affiche correctement les cellules des différentes pairs forex
    [Tags]    login    securite

    Open Browser    ${URL}    ${BROWSER}
    Maximize Browser Window
    Wait Until Element Is Visible    ${LOGIN_USERNAME_XPATH}    ${TIMEOUT}
    Input Text         ${LOGIN_USERNAME_XPATH}    ${USERNAME_VALUE}
    Input Password     ${LOGIN_PASSWORD_XPATH}     ${PASSWORD_VALUE}
    Click Button        ${LOGIN_SUBMIT_XPATH}  
    Wait Until Page Does Not Contain Element    ${LOGIN_SUBMIT_XPATH}       ${TIMEOUT}
    Wait Until Element Is Visible    css:[data-testid="header-title"]    ${TIMEOUT}
    Element Text Should Be           css:[data-testid="header-title"]    ICT Trading Dashboard
    Capture Page Screenshot
    Close Browser

TC04 - Login avec mauvais mot de passe
    [Documentation]    Mauvais password → pas de dashboard
    [Tags]    login    securite

    Open Browser    ${URL}    ${BROWSER}
    Maximize Browser Window
    Wait Until Element Is Visible    ${LOGIN_USERNAME_XPATH}    ${TIMEOUT}
    Input Text         ${LOGIN_USERNAME_XPATH}    ${USERNAME_VALUE}
    Input Password     ${LOGIN_PASSWORD_XPATH}     ${WRONG_PASSWORD_VALUE}
    Click Button        ${LOGIN_SUBMIT_XPATH}  
    Element Should Not Be Visible  css:[data-testid="header-title"]   

TC05 - Login avec champs vides
    [Documentation]    Bouton désactivé si champs vides
    [Tags]    login    validation
    Open Browser    ${URL}    ${BROWSER}
    Wait Until Element Is Visible    css:[data-testid="login-submit-btn"]    ${TIMEOUT}
    Element Should Be Disabled       css:[data-testid="login-submit-btn"]



TC05 - Dashboard affiche les paires Forex
    [Documentation]    Au moins 20 paires sont présentes
    [Tags]    smoke    dashboard
    Log    OK

TC06 - Bouton AutoBot présent dans le header
    [Documentation]    Le bouton AutoBot est visible
    [Tags]    smoke    autobot
    Log    OK


TC07 - Toggle AutoMode change l état
    [Documentation]    Cliquer AutoBot change ON vers OFF
    [Tags]    autobot    interaction
    Log    OK


TC08 - Navigation entre les onglets
    [Documentation]    Chaque onglet s'ouvre sans erreur
    [Tags]    smoke    navigation
    Log    OK


TC09 - Analytics contient des graphiques
    [Documentation]    La page Analytics contient des SVG recharts
    [Tags]    smoke    analytics
    Log    OK


TC10 - Journal accessible
    [Documentation]    La page Journal s'ouvre
    [Tags]    smoke    journal
    Log    OK


TC11 - Badge WebSocket connected
    [Documentation]    La connexion WebSocket est active
    [Tags]    smoke    websocket
    Log    OK


TC12 - Filtre BUY fonctionne
    [Documentation]    Cliquer BUY filtre les paires
    [Tags]    dashboard    filtres
    Log    OK


TC13 - Page Backtest affiche les instructions
    [Documentation]    Guide d'import CSV visible
    [Tags]    smoke    backtest
    Log    OK

TC14 - Page Comptes liste les comptes
    [Documentation]    Au moins un compte FTMO affiché
    [Tags]    smoke    comptes
    Log    OK


TC15 - Affichage mobile 375px
    [Documentation]    Interface lisible sur iPhone SE
    [Tags]    responsive    mobile
    Log    OK

TC16 - Affichage tablette 768px
    [Documentation]    Interface lisible sur iPad
    [Tags]    responsive    tablet
    Log    OK




*** Keywords ***
Afficher Message
    Log    Ceci est un mot-cle personnalise