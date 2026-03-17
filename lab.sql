-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Mar 17, 2026 at 06:22 PM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `lab`
--

-- --------------------------------------------------------

--
-- Table structure for table `chemicals`
--

CREATE TABLE `chemicals` (
  `id` int(11) NOT NULL,
  `name` varchar(150) NOT NULL,
  `quantity` decimal(12,2) NOT NULL DEFAULT 0.00,
  `max_quantity` decimal(12,2) NOT NULL DEFAULT 0.00,
  `low_stock_quantity` decimal(12,2) NOT NULL DEFAULT 0.00,
  `hazard_info` varchar(255) NOT NULL,
  `room_no` varchar(50) NOT NULL,
  `expiry_date` date DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `formula` varchar(120) NOT NULL DEFAULT '',
  `category` varchar(120) NOT NULL DEFAULT '',
  `unit` varchar(40) NOT NULL DEFAULT ''
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `chemicals`
--

INSERT INTO `chemicals` (`id`, `name`, `quantity`, `max_quantity`, `low_stock_quantity`, `hazard_info`, `room_no`, `expiry_date`, `created_at`, `updated_at`, `formula`, `category`, `unit`) VALUES
(1, 'Hydrochloric Acid', 0.00, 150.00, 25.00, '⚠️ Warning', '101', '2026-03-12', '2026-02-28 16:52:55', '2026-03-17 16:33:20', 'HCl', 'Acid', 'L'),
(3, 'Nitric Acid', 110.00, 150.00, 25.00, '🔥 Flammable', '1', '2026-04-10', '2026-03-16 08:31:40', '2026-03-17 16:12:28', 'HNO3', '', ''),
(4, 'Acetone', 11.80, 50.00, 5.00, '🔥 Flammable', 'Lab-1', NULL, '2026-03-17 16:03:39', '2026-03-17 16:31:39', 'C3H6O', 'Solvent', 'L'),
(5, 'Ethanol', 0.00, 60.00, 8.00, '🔥 Flammable', 'Lab-1', NULL, '2026-03-17 16:03:39', '2026-03-17 16:47:52', 'C2H6O', 'Solvent', 'L'),
(6, 'Methanol', 8.00, 40.00, 6.00, '🔥 Flammable', 'Lab-2', NULL, '2026-03-17 16:03:39', '2026-03-17 16:03:39', 'CH4O', 'Solvent', 'L'),
(8, 'Sulfuric Acid', 10.00, 35.00, 6.00, '☠️ Toxic', 'Lab-3', NULL, '2026-03-17 16:03:39', '2026-03-17 16:03:39', 'H2SO4', 'Acid', 'L'),
(9, 'Sodium Hydroxide', 18.00, 50.00, 10.00, '⚠️ Warning', 'Lab-4', NULL, '2026-03-17 16:03:39', '2026-03-17 16:03:39', 'NaOH', 'Base', 'kg'),
(10, 'Hydrogen Peroxide', 9.00, 30.00, 5.00, '⚠️ Warning', 'Lab-2', NULL, '2026-03-17 16:03:39', '2026-03-17 16:03:39', 'H2O2', 'Oxidizer', 'L'),
(11, 'Sodium Chloride', 25.00, 80.00, 12.00, '⚠️ Warning', 'Lab-5', NULL, '2026-03-17 16:03:39', '2026-03-17 16:03:39', 'NaCl', 'Salt', 'kg');

-- --------------------------------------------------------

--
-- Table structure for table `logs`
--

CREATE TABLE `logs` (
  `id` int(11) NOT NULL,
  `chemical_id` int(11) NOT NULL,
  `action` enum('use','refill') NOT NULL,
  `amount` decimal(12,2) NOT NULL,
  `date` timestamp NOT NULL DEFAULT current_timestamp(),
  `user` varchar(120) NOT NULL,
  `purpose` varchar(160) DEFAULT NULL,
  `class_name` varchar(120) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `logs`
--

INSERT INTO `logs` (`id`, `chemical_id`, `action`, `amount`, `date`, `user`, `purpose`, `class_name`) VALUES
(1, 1, 'use', 125.00, '2026-03-09 05:54:24', 'teacher', NULL, NULL),
(2, 1, 'use', 5.00, '2026-03-09 05:55:38', 'teacher', NULL, NULL),
(3, 1, 'refill', 25.00, '2026-03-16 07:43:33', 'sandesh', NULL, NULL),
(4, 1, 'use', 25.00, '2026-03-16 08:02:20', 'bhushan', NULL, NULL),
(5, 3, 'use', 110.00, '2026-03-16 08:31:59', 'teacher', NULL, NULL),
(6, 3, 'refill', 100.00, '2026-03-17 16:00:06', 'admin', NULL, NULL),
(7, 4, 'use', 0.20, '2026-03-17 16:31:39', 'admin', NULL, 'BSC 2'),
(8, 1, 'use', 20.00, '2026-03-17 16:33:20', 'admin', NULL, NULL),
(9, 5, 'use', 20.00, '2026-03-17 16:47:52', 'admin', 'chem lab', 'Chem-2');

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `name` varchar(120) NOT NULL,
  `email` varchar(190) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `role` varchar(40) NOT NULL DEFAULT 'staff',
  `reset_code` varchar(20) DEFAULT NULL,
  `reset_expires` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `name`, `email`, `password_hash`, `role`, `reset_code`, `reset_expires`, `created_at`) VALUES
(1, 'admin', 'admin@gmail.com', 'b9902755f81fd7aacd29d9633dd8c2be:49781650e0f6dcd28ca4ddfb2591626bdfecdcabadd2292b4a34246a2b14d7f2', 'staff', NULL, NULL, '2026-03-17 15:42:48');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `chemicals`
--
ALTER TABLE `chemicals`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `logs`
--
ALTER TABLE `logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `chemical_id` (`chemical_id`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `chemicals`
--
ALTER TABLE `chemicals`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=12;

--
-- AUTO_INCREMENT for table `logs`
--
ALTER TABLE `logs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `logs`
--
ALTER TABLE `logs`
  ADD CONSTRAINT `logs_ibfk_1` FOREIGN KEY (`chemical_id`) REFERENCES `chemicals` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
