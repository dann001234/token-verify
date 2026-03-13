CREATE TABLE `tokenProcessing` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`token` text NOT NULL,
	`tokenPreview` varchar(50) NOT NULL,
	`oauthUrl` text NOT NULL,
	`status` enum('pending','success','error','captcha_required') NOT NULL DEFAULT 'pending',
	`errorMessage` text,
	`processedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tokenProcessing_id` PRIMARY KEY(`id`)
);
