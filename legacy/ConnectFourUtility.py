from timeit import default_timer
from random import choice
from math import sqrt, log


class Board:

    def __init__(self):
        self.ROWCOUNT = 6
        self.COLUMNCOUNT = 7
        self.boardMask = 4398046511103
        self.colMask = 63
        self.rowMask = 69810262081
        self.leftMask = (34630287489, 541098242, 8454660, 2216338399296, 1108169199616, 554084597760)
        self.rightMask = (1108378656, 17318416, 270600, 70936233984, 141872463872, 283744665600)

    @staticmethod
    def start():
        # (bit board for player 1, bit board for player 2, player's turn
        return 0, 0, 1

    def updateState(self, state, col):
        # player information
        playerIndex = state[2] - 1
        opponentIndex = 1 - playerIndex

        # current bit masks
        shift = self.ROWCOUNT * col
        colMask = self.colMask << shift
        playerMask = state[playerIndex] & colMask
        opponentMask = state[opponentIndex] & colMask

        # updated bit masks
        curr = playerMask | opponentMask
        new = ((curr << 1) | (1 << shift)) ^ opponentMask
        playerCol = state[playerIndex] | new

        # outputs new state
        return (playerCol, state[1], 3 - state[2]) if playerIndex == 0 else (state[0], playerCol, 3 - state[2])

    def getLegalMoves(self, state):
        return tuple(col for col in range(self.COLUMNCOUNT) if not self.isColumnFull(state, col))

    def isLegalMove(self, state, col):
        if 0 <= col < self.COLUMNCOUNT and not self.isColumnFull(state, col):
            return True
        return False

    def isColumnFull(self, state, col):
        mask = self.colMask << (self.ROWCOUNT * col)
        return (state[0] | state[1]) & mask == mask

    def isBoardFull(self, state):
        return state[0] | state[1] == self.boardMask

    def hasWinner(self, state):
        mask = state[2 - state[2]]
        if self.hasRowWinner(mask) or self.hasColWinner(mask) or self.hasDiagonalWinner(mask):
            return 3 - state[2]
        return 0

    def hasColWinner(self, playerMask):
        for col in range(self.COLUMNCOUNT):
            colMask = playerMask & (self.colMask << (self.ROWCOUNT * col))
            if colMask & (colMask << 1) & (colMask << 2) & (colMask << 3):
                return True
        return False

    def hasRowWinner(self, playerMask):

        for row in range(self.ROWCOUNT):
            rowMask = playerMask & (self.rowMask << row)
            if rowMask & (rowMask << self.ROWCOUNT) & (rowMask << (self.ROWCOUNT * 2)) & (rowMask << (self.ROWCOUNT * 3)):
                return True
        return False

    def hasDiagonalWinner(self, playerMask):
        for mask in self.leftMask:
            leftMask = playerMask & mask
            if leftMask & (leftMask << self.COLUMNCOUNT) & (leftMask << (self.COLUMNCOUNT * 2)) & (leftMask << (self.COLUMNCOUNT * 3)):
                return True

        inc = self.ROWCOUNT - 1
        for mask in self.rightMask:
            rightMask = playerMask & mask
            if rightMask & (rightMask >> inc) & (rightMask >> (inc * 2)) & (rightMask >> (inc * 3)):
                return True
        return False

    def displayBoard(self, state):
        board = [self.COLUMNCOUNT * [""] for _ in range(self.ROWCOUNT)]
        player1 = state[0]
        player2 = state[1]
        bit = 1
        for shift in range(self.ROWCOUNT * self.COLUMNCOUNT):
            if bit & player1:
                col = shift // self.ROWCOUNT
                row = 5 - shift % self.ROWCOUNT
                board[row][col] = "red"
            elif bit & player2:
                col = shift // self.ROWCOUNT
                row = 5 - shift % self.ROWCOUNT
                board[row][col] = "yellow"
            bit = bit << 1
        return board


class AI:

    def __init__(self, board, **kwarg):
        self.board = board
        self.states = []
        self.plays = {}
        self.wins = {}
        self.calculationTime = kwarg.get("calculationTime", 5)
        self.maxDepth = kwarg.get("maxDepth", 50)
        self.constant = kwarg.get("constant", sqrt(2))

    def updateStates(self, state):
        # checks for the correct data type
        if isinstance(state, tuple):
            self.states.append(state)

    def getNextMoves(self):
        # current state
        state = self.states[-1]
        legal = self.board.getLegalMoves(state)

        if len(legal) == 0:
            return False

        if len(legal) == 1:
            return legal[0]

        # begins simulation
        start = default_timer()
        while default_timer() - start < self.calculationTime:
            self.runSimulation()

        # selects the best move
        nextMove = None
        highestWinRate = 0
        for move in legal:
            nextState = self.board.updateState(state, move)
            winRate = self.wins.get(nextState, 0) / self.plays.get(nextState, 1)
            if winRate > highestWinRate:
                highestWinRate = winRate
                nextMove = move
        return nextMove

    def runSimulation(self):
        plays = self.plays
        wins = self.wins
        state = self.states[-1]
        visitedState = set()
        expand = True
        draw = False
        win = 0

        # begins simulation
        for depth in range(self.maxDepth):

            # retrieves all legal moves
            legal = self.board.getLegalMoves(state)

            # 0 legal moves remaining
            if len(legal) == 0:
                draw = True
                break

            nextStates = [self.board.updateState(state, move) for move in legal]

            # checks whether all positions have been explored previously
            if all(pos in plays for pos in nextStates):
                TotalPlay = sum((plays[pos] for pos in nextStates))
                highest, state = max(((wins[pos] / plays[pos] + self.constant * sqrt(log(TotalPlay) / plays[pos]), pos) for pos in nextStates))

            else:
                state = choice(nextStates)

            # checks if exploration phase has ended
            if expand and state not in plays:
                expand = False
                plays[state] = 0
                wins[state] = 0

            # adds the current state to the set of visited states
            visitedState.add(state)

            # checks if a winning position has been reached
            win = self.board.hasWinner(state)
            if win != 0:
                break

        # result is a draw
        if draw:
            for pos in visitedState:
                if pos not in plays:
                    continue
                plays[pos] += 1
                wins[pos] += 0.5

        # result is not a draw
        else:
            for pos in visitedState:
                if pos not in plays:
                    continue
                plays[pos] += 1
                if 3 - pos[2] == win:
                    wins[pos] += 1
