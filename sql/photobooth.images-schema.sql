/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40101 SET NAMES binary*/;
CREATE TABLE `images` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `participantId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `originalImageUrl` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `aiImageUrl` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `processingStatus` enum('queued','processing','generated','sms_sent','failed') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'queued',
  `downloadCount` int NOT NULL DEFAULT '0',
  `errorMessage` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `smsSent` tinyint(1) NOT NULL DEFAULT '0',
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  `smsAttempts` int NOT NULL DEFAULT '0',
  `smsLastAttemptAt` datetime(3) DEFAULT NULL,
  `clientRequestId` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `renderedAiPath` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `renderedOriginalPath` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  KEY `images_participantId_idx` (`participantId`),
  KEY `images_processingStatus_idx` (`processingStatus`),
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `images_clientRequestId_key` (`clientRequestId`),
  CONSTRAINT `images_participantId_fkey` FOREIGN KEY (`participantId`) REFERENCES `participants` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
