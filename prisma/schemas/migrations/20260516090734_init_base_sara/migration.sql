-- CreateTable
CREATE TABLE "sara_wallet" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "tenant_id" VARCHAR(10) NOT NULL DEFAULT 'CI',
    "user_id" TEXT NOT NULL,
    "solde_fcfa" INTEGER NOT NULL DEFAULT 0,
    "solde_points" INTEGER NOT NULL DEFAULT 0,
    "statut" TEXT NOT NULL DEFAULT 'ACTIF',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sara_wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sara_transaction" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "tenant_id" VARCHAR(10) NOT NULL DEFAULT 'CI',
    "wallet_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "montant_fcfa" INTEGER NOT NULL,
    "solde_avant" INTEGER NOT NULL,
    "solde_apres" INTEGER NOT NULL,
    "reference" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "description" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'SUCCES',
    "provider" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sara_transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sara_tontine" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "tenant_id" VARCHAR(10) NOT NULL DEFAULT 'CI',
    "nom" TEXT NOT NULL,
    "montant_fcfa" INTEGER NOT NULL,
    "frequence" TEXT NOT NULL,
    "nb_membres_max" INTEGER NOT NULL DEFAULT 10,
    "statut" TEXT NOT NULL DEFAULT 'OUVERTE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sara_tontine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sara_tontine_membre" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "tenant_id" VARCHAR(10) NOT NULL DEFAULT 'CI',
    "tontine_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "ordre_tour" INTEGER NOT NULL,
    "a_recu" BOOLEAN NOT NULL DEFAULT false,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sara_tontine_membre_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sara_score" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "tenant_id" VARCHAR(10) NOT NULL DEFAULT 'CI',
    "user_id" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "niveau" TEXT NOT NULL DEFAULT 'DEBUTANT',
    "nb_quiz_repondus" INTEGER NOT NULL DEFAULT 0,
    "nb_jours_consecutifs" INTEGER NOT NULL DEFAULT 0,
    "nb_tontines_honores" INTEGER NOT NULL DEFAULT 0,
    "nb_paiements_temps" INTEGER NOT NULL DEFAULT 0,
    "last_computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sara_score_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sara_article" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "tenant_id" VARCHAR(10) NOT NULL DEFAULT 'CI',
    "nom" TEXT NOT NULL,
    "description" TEXT,
    "prix_fcfa" INTEGER NOT NULL,
    "prix_points" INTEGER NOT NULL DEFAULT 0,
    "categorie" TEXT NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT -1,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sara_article_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sara_wallet_tenant_id_idx" ON "sara_wallet"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "sara_wallet_user_id_tenant_id_key" ON "sara_wallet"("user_id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "sara_transaction_reference_key" ON "sara_transaction"("reference");

-- CreateIndex
CREATE INDEX "sara_transaction_wallet_id_idx" ON "sara_transaction"("wallet_id");

-- CreateIndex
CREATE INDEX "sara_transaction_tenant_id_created_at_idx" ON "sara_transaction"("tenant_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "sara_tontine_tenant_id_idx" ON "sara_tontine"("tenant_id");

-- CreateIndex
CREATE INDEX "sara_tontine_membre_tenant_id_idx" ON "sara_tontine_membre"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "sara_tontine_membre_tontine_id_user_id_key" ON "sara_tontine_membre"("tontine_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "sara_score_user_id_key" ON "sara_score"("user_id");

-- CreateIndex
CREATE INDEX "sara_score_tenant_id_idx" ON "sara_score"("tenant_id");

-- CreateIndex
CREATE INDEX "sara_score_score_idx" ON "sara_score"("score" DESC);

-- CreateIndex
CREATE INDEX "sara_article_tenant_id_actif_idx" ON "sara_article"("tenant_id", "actif");

-- AddForeignKey
ALTER TABLE "sara_transaction" ADD CONSTRAINT "sara_transaction_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "sara_wallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sara_tontine_membre" ADD CONSTRAINT "sara_tontine_membre_tontine_id_fkey" FOREIGN KEY ("tontine_id") REFERENCES "sara_tontine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
