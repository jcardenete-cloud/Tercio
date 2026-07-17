CREATE DATABASE IF NOT EXISTS control_horario;
USE control_horario;

CREATE TABLE IF NOT EXISTS dias (
    fecha DATE PRIMARY KEY,
    tipo ENUM('laborable', 'festivo', 'libre') DEFAULT 'laborable',
    horas_reales DECIMAL(4,2) DEFAULT 7.00,
    comentario TEXT
);

CREATE TABLE IF NOT EXISTS configuracion (
    clave VARCHAR(50) PRIMARY KEY,
    valor VARCHAR(255)
);

INSERT INTO configuracion (clave, valor) VALUES ('horas_diarias', '7');
