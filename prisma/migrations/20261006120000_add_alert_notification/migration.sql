-- CreateTable
CREATE TABLE "AlertNotification" (
    "key" TEXT NOT NULL,
    "station" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlertNotification_pkey" PRIMARY KEY ("key")
);
