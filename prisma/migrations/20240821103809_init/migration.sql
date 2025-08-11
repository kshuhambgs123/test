-- CreateTable
CREATE TABLE "Logs" (
    "LogID" TEXT NOT NULL,
    "userID" TEXT NOT NULL,
    "leadsRequested" INTEGER NOT NULL,
    "leadsEnriched" INTEGER,
    "apolloLink" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "creditsUsed" INTEGER NOT NULL,
    "url" TEXT,
    "status" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Logs_pkey" PRIMARY KEY ("LogID")
);

-- CreateTable
CREATE TABLE "ApiKeys" (
    "apiKeyID" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "userID" TEXT NOT NULL,

    CONSTRAINT "ApiKeys_pkey" PRIMARY KEY ("apiKeyID")
);

-- CreateTable
CREATE TABLE "User" (
    "UserID" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "companyName" TEXT,
    "phoneNumber" TEXT,
    "location" TEXT,
    "credits" INTEGER NOT NULL,
    "apikey" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("UserID")
);

-- CreateTable
CREATE TABLE "Admin" (
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("email")
);

-- CreateIndex
CREATE UNIQUE INDEX "Logs_LogID_key" ON "Logs"("LogID");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKeys_apiKeyID_key" ON "ApiKeys"("apiKeyID");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKeys_userID_key" ON "ApiKeys"("userID");

-- CreateIndex
CREATE UNIQUE INDEX "User_UserID_key" ON "User"("UserID");

-- CreateIndex
CREATE UNIQUE INDEX "Admin_email_key" ON "Admin"("email");

-- AddForeignKey
ALTER TABLE "Logs" ADD CONSTRAINT "Logs_userID_fkey" FOREIGN KEY ("userID") REFERENCES "User"("UserID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_UserID_fkey" FOREIGN KEY ("UserID") REFERENCES "ApiKeys"("userID") ON DELETE RESTRICT ON UPDATE CASCADE;
