UNAME_S := $(shell uname -s)

CXX = g++
CXXFLAGS = -O3 -std=c++20 -I./include

ifeq ($(UNAME_S),Linux)
    LIBS = -pthread -lutil -lgit2
else
    LIBS = -pthread -lgit2
endif

TARGET = ce-backend
SRC = src/main.cpp \
      src/FileSystemService.cpp \
      src/TerminalManager.cpp \
      src/AgentService.cpp \
      src/JSONRPCRouter.cpp \
      src/WebSocketServer.cpp \
      src/GitService.cpp

all: $(TARGET)

$(TARGET): $(SRC)
	$(CXX) $(CXXFLAGS) $(SRC) -o $(TARGET) $(LIBS)

clean:
	rm -f $(TARGET)

run: all
	./$(TARGET)
