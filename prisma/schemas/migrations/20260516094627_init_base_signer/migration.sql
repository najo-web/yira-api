/*
  Warnings:

  - You are about to drop the `sara_article` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `sara_score` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `sara_tontine` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `sara_tontine_membre` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `sara_transaction` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `sara_wallet` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "sara_tontine_membre" DROP CONSTRAINT "sara_tontine_membre_tontine_id_fkey";

-- DropForeignKey
ALTER TABLE "sara_transaction" DROP CONSTRAINT "sara_transaction_wallet_id_fkey";

-- DropTable
DROP TABLE "sara_article";

-- DropTable
DROP TABLE "sara_score";

-- DropTable
DROP TABLE "sara_tontine";

-- DropTable
DROP TABLE "sara_tontine_membre";

-- DropTable
DROP TABLE "sara_transaction";

-- DropTable
DROP TABLE "sara_wallet";

-- CreateTable
CREATE TABLE "yira_merchant" (
    "id" TEXT NOT NULL,
    "telephone" TEXT NOT NULL,
    "nom" TEXT,
    "prenom" TEXT,
    "country_code" TEXT NOT NULL DEFAULT 'CI',
    "tenant_id" TEXT,
    "kyc_niveau" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "yira_merchant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "yira_signer_collecteur_principal" (
    "id" TEXT NOT NULL,
    "telephone" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "prenom" TEXT,
    "zones" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "country_code" TEXT NOT NULL DEFAULT 'CI',
    "tenant_id" TEXT,
    "wallet_id" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'EN_ATTENTE',
    "saas_actif" BOOLEAN NOT NULL DEFAULT false,
    "saas_montant" INTEGER NOT NULL DEFAULT 50000,
    "volume_min" INTEGER NOT NULL DEFAULT 200,
    "taux_completion_min" DOUBLE PRECISION NOT NULL DEFAULT 75,
    "reversement_pct" DOUBLE PRECISION NOT NULL DEFAULT 25,
    "score_performance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "date_contrat" TIMESTAMP(3),
    "renouvellement" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "yira_signer_collecteur_principal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "yira_signer_collecteur_terrain" (
    "id" TEXT NOT NULL,
    "telephone" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "prenom" TEXT,
    "zone" TEXT NOT NULL,
    "country_code" TEXT NOT NULL DEFAULT 'CI',
    "principal_id" TEXT NOT NULL,
    "wallet_id" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'ACTIF',
    "quota_min" INTEGER NOT NULL DEFAULT 50,
    "taux_completion" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "score_perf" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "prime_eligible" BOOLEAN NOT NULL DEFAULT false,
    "total_carnets" INTEGER NOT NULL DEFAULT 0,
    "total_credits" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "yira_signer_collecteur_terrain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "yira_signer_carnet" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "merchant_id" TEXT NOT NULL,
    "collecteur_terrain_id" TEXT,
    "collecteur_principal_id" TEXT,
    "tenant_id" TEXT,
    "telephone" TEXT NOT NULL,
    "mise_jour" INTEGER NOT NULL,
    "projet" TEXT,
    "type_projet" TEXT NOT NULL DEFAULT 'AUTRE',
    "statut" TEXT NOT NULL DEFAULT 'OUVERT',
    "jour_actuel" INTEGER NOT NULL DEFAULT 0,
    "jours_signes" INTEGER NOT NULL DEFAULT 0,
    "epargne_cumulee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "epargne_compte" TEXT,
    "nb_pauses" INTEGER NOT NULL DEFAULT 0,
    "en_pause" BOOLEAN NOT NULL DEFAULT false,
    "pause_fin" TIMESTAMP(3),
    "canal_dominant" TEXT NOT NULL DEFAULT 'USSD',
    "kyc_niveau" INTEGER NOT NULL DEFAULT 0,
    "date_debut" TIMESTAMP(3),
    "date_fin_prevue" TIMESTAMP(3),
    "date_completion" TIMESTAMP(3),
    "commission_versee" BOOLEAN NOT NULL DEFAULT false,
    "score_regularite" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "country_code" TEXT NOT NULL DEFAULT 'CI',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "yira_signer_carnet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "yira_signer_jour" (
    "id" TEXT NOT NULL,
    "carnet_id" TEXT NOT NULL,
    "numero_jour" INTEGER NOT NULL,
    "montant" DOUBLE PRECISION NOT NULL,
    "canal" TEXT NOT NULL DEFAULT 'USSD_WALLET',
    "signe_par" TEXT NOT NULL DEFAULT 'CLIENT',
    "telephone_payeur" TEXT,
    "reference_tx" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'SIGNE',
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "country_code" TEXT NOT NULL DEFAULT 'CI',

    CONSTRAINT "yira_signer_jour_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "yira_signer_dossier_credit" (
    "id" TEXT NOT NULL,
    "carnet_id" TEXT NOT NULL,
    "merchant_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "telephone" TEXT NOT NULL,
    "carnets_completes" INTEGER NOT NULL DEFAULT 0,
    "jours_signes_total" INTEGER NOT NULL,
    "jours_possibles" INTEGER NOT NULL,
    "regularite_pct" DOUBLE PRECISION NOT NULL,
    "epargne_totale" DOUBLE PRECISION NOT NULL,
    "capacite_mensuelle" DOUBLE PRECISION NOT NULL,
    "canal_dominant" TEXT NOT NULL,
    "kyc_niveau" INTEGER NOT NULL,
    "anciennete_jours" INTEGER NOT NULL,
    "score_credit" DOUBLE PRECISION NOT NULL,
    "niveau_credit" TEXT NOT NULL DEFAULT 'DEBUTANT',
    "montant_max_suggere" DOUBLE PRECISION NOT NULL,
    "multiplicateur" DOUBLE PRECISION NOT NULL DEFAULT 3,
    "recommandation" TEXT NOT NULL DEFAULT 'NON_ELIGIBLE',
    "projet" TEXT,
    "type_projet" TEXT NOT NULL DEFAULT 'AUTRE',
    "statut" TEXT NOT NULL DEFAULT 'EN_ATTENTE',
    "decision_banque" TEXT,
    "montant_accorde" DOUBLE PRECISION,
    "taux_interet" DOUBLE PRECISION,
    "duree_mois" INTEGER,
    "mensualite" DOUBLE PRECISION,
    "mise_remboursement" DOUBLE PRECISION,
    "date_envoi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "date_decision" TIMESTAMP(3),
    "pdf_url" TEXT,
    "country_code" TEXT NOT NULL DEFAULT 'CI',

    CONSTRAINT "yira_signer_dossier_credit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "yira_signer_wallet" (
    "id" TEXT NOT NULL,
    "merchant_id" TEXT NOT NULL,
    "solde" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "yira_signer_wallet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "yira_merchant_telephone_key" ON "yira_merchant"("telephone");

-- CreateIndex
CREATE UNIQUE INDEX "yira_signer_collecteur_principal_telephone_key" ON "yira_signer_collecteur_principal"("telephone");

-- CreateIndex
CREATE UNIQUE INDEX "yira_signer_collecteur_terrain_telephone_key" ON "yira_signer_collecteur_terrain"("telephone");

-- CreateIndex
CREATE UNIQUE INDEX "yira_signer_carnet_reference_key" ON "yira_signer_carnet"("reference");

-- CreateIndex
CREATE INDEX "yira_signer_carnet_merchant_id_idx" ON "yira_signer_carnet"("merchant_id");

-- CreateIndex
CREATE INDEX "yira_signer_carnet_statut_idx" ON "yira_signer_carnet"("statut");

-- CreateIndex
CREATE UNIQUE INDEX "yira_signer_jour_carnet_id_numero_jour_key" ON "yira_signer_jour"("carnet_id", "numero_jour");

-- CreateIndex
CREATE UNIQUE INDEX "yira_signer_dossier_credit_carnet_id_key" ON "yira_signer_dossier_credit"("carnet_id");

-- CreateIndex
CREATE INDEX "yira_signer_dossier_credit_merchant_id_idx" ON "yira_signer_dossier_credit"("merchant_id");

-- CreateIndex
CREATE INDEX "yira_signer_dossier_credit_tenant_id_idx" ON "yira_signer_dossier_credit"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "yira_signer_wallet_merchant_id_key" ON "yira_signer_wallet"("merchant_id");

-- AddForeignKey
ALTER TABLE "yira_signer_collecteur_terrain" ADD CONSTRAINT "yira_signer_collecteur_terrain_principal_id_fkey" FOREIGN KEY ("principal_id") REFERENCES "yira_signer_collecteur_principal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "yira_signer_carnet" ADD CONSTRAINT "yira_signer_carnet_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "yira_merchant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "yira_signer_carnet" ADD CONSTRAINT "yira_signer_carnet_collecteur_terrain_id_fkey" FOREIGN KEY ("collecteur_terrain_id") REFERENCES "yira_signer_collecteur_terrain"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "yira_signer_carnet" ADD CONSTRAINT "yira_signer_carnet_collecteur_principal_id_fkey" FOREIGN KEY ("collecteur_principal_id") REFERENCES "yira_signer_collecteur_principal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "yira_signer_jour" ADD CONSTRAINT "yira_signer_jour_carnet_id_fkey" FOREIGN KEY ("carnet_id") REFERENCES "yira_signer_carnet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "yira_signer_dossier_credit" ADD CONSTRAINT "yira_signer_dossier_credit_carnet_id_fkey" FOREIGN KEY ("carnet_id") REFERENCES "yira_signer_carnet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
