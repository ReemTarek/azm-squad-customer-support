-- CreateTable
CREATE TABLE "BrandingConfig" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "appName" TEXT,
    "logoPath" TEXT,
    "primaryColor" TEXT,
    "updatedAt" DATETIME NOT NULL
);
