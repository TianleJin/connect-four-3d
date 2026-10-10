import sys
import pygame
from ConnectFourUtility import AI, Board


BLUE = (0, 0, 255)
BLACK = (0, 0, 0)
RED = (255, 0, 0)
YELLOW = (255, 255, 0)
ROWCOUNT = 6
COLUMNCOUNT = 7
RADIUS = 35
SQUARESIZE = 80


class ConnectFour:

    def __init__(self, playerNumber):
        pygame.init()
        pygame.display.set_caption('Connect 4')

        self.width = COLUMNCOUNT * SQUARESIZE
        self.height = (ROWCOUNT + 1) * SQUARESIZE
        self.screen = pygame.display.set_mode((self.width, self.height))
        self.MONOSPACE = pygame.font.SysFont("monospace", 55)

        turn = 1
        playerColour = RED if playerNumber == 1 else YELLOW
        computerNumber = 3 - playerNumber
        computerColour = YELLOW if playerNumber == 1 else RED

        game = Board()
        computer = AI(game, calculationTime=2, constant=0.9)
        state = game.start()
        computer.updateStates(state)
        display = game.displayBoard(state)
        self.drawBoard(display)

        gameOver = False
        while not gameOver:

            for event in pygame.event.get():

                if event.type == pygame.QUIT:
                    sys.exit()

                if turn == playerNumber:

                    if event.type == pygame.MOUSEMOTION:
                        self.paintBlackRectangle()
                        pygame.draw.circle(self.screen, playerColour, (event.pos[0], SQUARESIZE // 2), RADIUS)
                        pygame.display.update()

                    if event.type == pygame.MOUSEBUTTONDOWN:
                        pygame.event.set_blocked(pygame.MOUSEBUTTONDOWN)
                        col = event.pos[0] // SQUARESIZE

                        if game.isLegalMove(state, col):
                            state = game.updateState(state, col)
                            computer.updateStates(state)
                            display = game.displayBoard(state)
                            self.drawBoard(display)

                            if game.hasWinner(state):
                                gameOver = True
                                self.paintBlackRectangle()
                                self.screen.blit(self.MONOSPACE.render("Player {} wins!".format(playerNumber), 1, playerColour), (40, 10))

                            if game.isBoardFull(state):
                                gameOver = True
                                self.paintBlackRectangle()
                                self.screen.blit(self.MONOSPACE.render("Draw declared!!", 1, BLUE), (40, 10))

                            if gameOver:
                                pygame.event.set_blocked(pygame.MOUSEBUTTONDOWN)
                                pygame.display.update()
                                pygame.time.wait(5000)

                            turn = 1 if turn == 2 else 2

                else:

                    self.paintBlackRectangle()
                    pygame.display.update()
                    state = game.updateState(state, computer.getNextMoves())
                    computer.updateStates(state)
                    display = game.displayBoard(state)
                    self.drawBoard(display)

                    if game.hasWinner(state):
                        gameOver = True
                        self.paintBlackRectangle()
                        self.screen.blit(self.MONOSPACE.render("Player {} wins!!".format(computerNumber), 1, computerColour), (40, 10))

                    if game.isBoardFull(state):
                        gameOver = True
                        self.paintBlackRectangle()
                        self.screen.blit(self.MONOSPACE.render("Draw declared!!", 1, BLUE), (40, 10))

                    if gameOver:
                        pygame.event.set_blocked(pygame.MOUSEBUTTONDOWN)
                        pygame.display.update()
                        pygame.time.wait(5000)

                    turn = 1 if turn == 2 else 2
                    pygame.event.set_allowed(pygame.MOUSEBUTTONDOWN)

    def drawBoard(self, board):
        for c in range(COLUMNCOUNT):
            for r in range(ROWCOUNT):
                pygame.draw.rect(self.screen, BLUE, (c * SQUARESIZE, (r + 1) * SQUARESIZE, SQUARESIZE, SQUARESIZE))
                if board[r][c] == "":
                    pygame.draw.circle(self.screen, BLACK, (int((c + 0.5) * SQUARESIZE), int((r + 1.5) * SQUARESIZE)), RADIUS)
                elif board[r][c] == "red":
                    pygame.draw.circle(self.screen, RED, (int((c + 0.5) * SQUARESIZE), int((r + 1.5) * SQUARESIZE)), RADIUS)
                elif board[r][c] == "yellow":
                    pygame.draw.circle(self.screen, YELLOW, (int((c + 0.5) * SQUARESIZE), int((r + 1.5) * SQUARESIZE)), RADIUS)
        pygame.display.update()

    def paintBlackRectangle(self):
        pygame.draw.rect(self.screen, BLACK, (0, 0, self.width, SQUARESIZE))


if __name__ == "__main__":

    while True:
        try:
            player = int(input('Would you like to be player 1 or 2? '))
            if player not in (1, 2):
                raise ValueError
            break
        except ValueError:
            pass

    newGame = ConnectFour(player)
