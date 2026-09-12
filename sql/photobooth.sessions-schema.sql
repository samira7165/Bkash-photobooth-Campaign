/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40101 SET NAMES binary*/;
CREATE TABLE `sessions` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `gender` enum('male','female') COLLATE utf8mb4_unicode_ci NOT NULL,
  `selectedJob` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `customJob` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `originalImagePath` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `generatedImagePath` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('created','job_selected','image_captured','queued','processing','generated','sms_sent','failed') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'created',
  `smsSent` tinyint(1) NOT NULL DEFAULT '0',
  `smsShortUrl` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `queuePosition` int DEFAULT NULL,
  `errorMessage` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  `college` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `downloadCount` int NOT NULL DEFAULT '0',
  `smsAttempts` int NOT NULL DEFAULT '0',
  `smsLastAttemptAt` datetime(3) DEFAULT NULL,
  `renderedGeneratedPath` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `renderedOriginalPath` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  KEY `sessions_phone_idx` (`phone`),
  KEY `sessions_status_idx` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
