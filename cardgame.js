
require('dotenv').config();
const apiKey = process.env.API_KEY;

const url = "https://koodipahkina.monad.fi/api/game";
const myHeaders = new Headers();
myHeaders.append("Authorization", apiKey);
myHeaders.append("Content-Type", "application/json");

/**
 * Checks if a card is close to one of our cards when we already have 4 cards
 * @param {*} gameState state of the game in json
 * @param {*} myCardsAmount amount of cards my player has
 * @param {*} me my player object in json
 * @returns true if its a good card, false if its not
 */
function goodCardMidGame(gameState, myCardsAmount, me) {
    if (myCardsAmount > 4) {
        for (i = 0; i < me.cards.length; i++) {
            let first = me.cards[i][0];
            let last = me.cards[i][me.cards.length - 1];
            firstDifference = Math.abs(first - gameState.status.card);
            lastDifference = Math.abs(last - gameState.status.card);
            if (firstDifference < 3 || lastDifference < 3) {
                let isBetweenTaken = betweenTaken(first, last, gameState.status.card, othersCards);
                if (!isBetweenTaken) {
                    return true;
                }
            }
        }
    }
    return false;
}

/**
 * In the early game checks if a card is close to the cards we've already taken
 * @param {*} gameState state of the game in json
 * @param {*} myCardsAmount amount of cards my player has
 * @param {*} me my player object
 * @returns true if its a close card to some of ours, false if its not or if its late in the game
 */
function goodCardBeginning(gameState, myCardsAmount, me) {
    if (myCardsAmount <= 4 && gameState.status.money > 3) {
        for (i = 0; i < me.cards.length; i++) {
            for (j = 0; j < me.cards[i].length; j++) {
                difference = Math.abs(me.cards[i][j] - gameState.status.card);
                if (difference < 6) {
                    return true;
                }
            }
        }
    }
    return false;
}

// Check if targetCard is taken by other players
function checkOthersCards(targetCard, othersCards) {
    for (i = 0; i < othersCards.length; i++) {
        if (othersCards[i] == targetCard) {
            return true;
        }
    }
    return false;
}

// Checks if other players have a card that would be between our card and the
// current card thats being offered. For example if 11 is being offered and we have 13,
// then we will check if the other players have taken the card 12.
// If the between card is not taken return false. If it is return true.
function betweenTaken(first, last, offered) {

    if (first - offered == 2) {
        let between = first - 1;
        let taken = checkOthersCards(between, othersCards);
        if (taken == false) {
            return false
        }
    }
    if (last - offered == -2) {
        let between = last + 1;
        let taken = checkOthersCards(between, othersCards);
        if (taken == false) {
            return false;
        }
    }
    return true;
}

// Checks if the current offered card is the next one of some of our cards
// Returns true if the offered card is next to one of our cards, false if not
function isNeighbourCard(me, gameState) {
    for (i = 0; i < me.cards.length; i++) {
        let first = me.cards[i][0];
        let last = me.cards[i][me.cards.length - 1];
        firstDifference = Math.abs(first - gameState.status.card);
        lastDifference = Math.abs(last - gameState.status.card);
        if (firstDifference == 1 || lastDifference == 1) {
            return true;
        }
    }
    return false;
}

// Returns a list of other players cards
function getOthersCards(gameState) {
    var cards = [];
    const player1cards = gameState.status.players[1].cards;
    const player2cards = gameState.status.players[2].cards;
    const player3cards = gameState.status.players[3].cards;
    for (i = 0; i < player1cards.length; i++) {
        cards.concat(player1cards[i])
    }
    for (i = 0; i < player2cards.length; i++) {
        cards.concat(player2cards[i])
    }
    for (i = 0; i < player3cards.length; i++) {
        cards.concat(player3cards[i])
    }
    return cards;
}

// Counts the cards my player has
function countMyCards(me) {
    var amount = 0;
    for (i = 0; i < me.cards.length; i++) {
        for (j = 0; j < me.cards[i].length; j++) {
            amount += 1;
        }
    }
    return amount;
}

/**
 * Communicate with the api and update the game status
 * @param {*} gameUrl game specific url
 * @param {*} move true if we take the card, false if we place a coin
 * @returns updated game situation
 */
async function updateGame(gameUrl, move) {

    let gameState;
    try {
        const response = await fetch(gameUrl, {
            method: "POST",
            body: JSON.stringify({"takeCard": move}),
            headers: myHeaders,
        });
        if(!response.ok) {
            throw new Error('Error in placing coin fetch');
        }

        gameState = await response.json();
    } catch(error) {
        console.error("Error: ", error.message);
    }

    return gameState;
}

/**
 * Decide if we want to place a coin or take the card
 * according to the game status
 * @param {*} gameInfo initial game state in json
 */
async function gameHandler(gameInfo) {

    actionUrlEnd = "/" + gameInfo.gameId + "/action";
    gameUrl = url + actionUrlEnd;

    var gameState = await updateGame(gameUrl, false);
    var turnCounter = 1;

    // Read and operate the game until its finished
    while (gameState.status.finished == false) {

        me = gameState.status.players[0];
        myCardsAmount = countMyCards(me);
        othersCards = getOthersCards(gameState);
        
        // Out of money, have to take the card
        if (me.money == 0) {
            gameState = await updateGame(gameUrl, true);
            continue;
        }

        // Always take the card if we have it's neighbor
        if(isNeighbourCard(me, gameState)) {
            gameState = await updateGame(gameUrl, true);
            continue;
        }

        // Don't take the largest card
        if (gameState.status.card == 35 && turnCounter < 5) {
            console.log("Ei oteta näin isoa korttia.");
            gameState = await updateGame(gameUrl, false);
            continue;
        }

        // Take a card with a lot of coins placed on it
        if (gameState.status.money > 9 && turnCounter < 7) {
            console.log("Otetaan kolikot ja rakennetaan tämän kortin ympärille.");
            gameState = await updateGame(gameUrl, true);
            continue;
        }

        // Take an okay card and some coins
        if (gameState.status.money > 4 && turnCounter < 5 && gameState.status.card < 29) {
            console.log("Pieni kortti ja paljon kolikoita!");
            gameState = await updateGame(gameUrl, true);
            continue;
        }

        // Take possibly a good card in the early game
        if (goodCardBeginning(gameState, myCardsAmount, me)) {
            gameState = await updateGame(gameUrl, true);
            continue;
        }

        // Possibly a good card in the middle and late game
        if (goodCardMidGame(gameState, myCardsAmount, me)) {
            gameState = await updateGame(gameUrl, true);
            continue;
        }

        turnCounter += 1;
        gameState = await updateGame(gameUrl, false);
    };
}

// Start the game, get the initial game status from the api
async function startGame() {
    try {
        const response = await fetch(url, {
            method: "POST",
            headers: myHeaders,
        });
        if (!response.ok) {
            throw new Error('Error fetching from api');
        }
        const json = await response.json();
        gameHandler(json);

    } catch(error) {
        console.error("Error: ", error.message);
    }
    return;
}

startGame();