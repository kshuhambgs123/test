-- CreateTable
CREATE TABLE "BillingDetails" (
    "BillingID" TEXT NOT NULL,
    "userID" TEXT NOT NULL,
    "Url" TEXT NOT NULL,
    "CreditsRequested" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingDetails_pkey" PRIMARY KEY ("BillingID")
);

-- CreateIndex
CREATE UNIQUE INDEX "BillingDetails_BillingID_key" ON "BillingDetails"("BillingID");

-- AddForeignKey
ALTER TABLE "BillingDetails" ADD CONSTRAINT "BillingDetails_userID_fkey" FOREIGN KEY ("userID") REFERENCES "User"("UserID") ON DELETE RESTRICT ON UPDATE CASCADE;
