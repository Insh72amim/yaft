-- AlterTable
ALTER TABLE "SalaryStatement" ADD COLUMN     "pdfPasswordCipher" BYTEA,
ADD COLUMN     "pdfPasswordIv" BYTEA,
ADD COLUMN     "pdfPasswordKeyVersion" INTEGER DEFAULT 1,
ADD COLUMN     "pdfPasswordTag" BYTEA;
