<?php
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

$action = $_GET['action'] ?? '';
$statePath = __DIR__ . DIRECTORY_SEPARATOR . 'state.json';
$queuePath = __DIR__ . DIRECTORY_SEPARATOR . 'commands.queue';

function reply(array $body, int $status = 200) {
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}
function input_json(): array {
    $data = json_decode(file_get_contents('php://input'), true);
    return is_array($data) ? $data : [];
}
function locked_write(string $path, string $contents): bool {
    $file = fopen($path, 'c+');
    if ($file === false) return false;
    $ok = flock($file, LOCK_EX);
    if ($ok) {
        ftruncate($file, 0);
        rewind($file);
        $ok = fwrite($file, $contents) !== false;
        fflush($file);
        flock($file, LOCK_UN);
    }
    fclose($file);
    return $ok;
}

if ($action === 'state' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    $file = fopen($statePath, 'c+');
    if ($file === false) reply(['error' => 'state_unavailable'], 500);
    flock($file, LOCK_SH);
    rewind($file);
    $state = json_decode(stream_get_contents($file), true);
    flock($file, LOCK_UN);
    fclose($file);
    if (!is_array($state)) {
        $state = [
            'sensorOk' => false, 'temperature' => null, 'humidity' => null,
            'mode' => 'GREEN', 'controlMode' => 'AUTO', 'lightMode' => 'POT',
            'fan' => false, 'brightness' => 0, 'updatedAt' => 0,
        ];
    }
    $updatedAt = (int)($state['updatedAt'] ?? 0);
    $state['online'] = $updatedAt > 0 && (time() - $updatedAt) <= 6;
    unset($state['updatedAt']);
    reply($state);
}

if ($action === 'telemetry' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = input_json();
    $mode = $data['mode'] ?? '';
    $control = $data['controlMode'] ?? '';
    $light = $data['lightMode'] ?? '';
    $brightness = filter_var($data['brightness'] ?? null, FILTER_VALIDATE_INT);
    if (!in_array($mode, ['GREEN', 'YELLOW', 'RED'], true) ||
        !in_array($control, ['AUTO', 'MANUAL'], true) ||
        !in_array($light, ['POT', 'WEB'], true) ||
        $brightness === false || $brightness < 0 || $brightness > 255) {
        reply(['error' => 'invalid_telemetry'], 400);
    }
    $sensorOk = ($data['sensorOk'] ?? false) === true;
    $state = [
        'sensorOk' => $sensorOk,
        'temperature' => $sensorOk && is_numeric($data['temperature'] ?? null) ? (float)$data['temperature'] : null,
        'humidity' => $sensorOk && is_numeric($data['humidity'] ?? null) ? (float)$data['humidity'] : null,
        'mode' => $mode,
        'controlMode' => $control,
        'lightMode' => $light,
        'fan' => ($data['fan'] ?? false) === true,
        'brightness' => $brightness,
        'updatedAt' => time(),
    ];
    if (!locked_write($statePath, json_encode($state, JSON_UNESCAPED_SLASHES))) {
        reply(['error' => 'state_write_failed'], 500);
    }
    reply(['saved' => true]);
}

if ($action === 'command' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = input_json();
    $command = trim((string)($data['command'] ?? ''));
    $allowed = ['A', 'G', 'C,AUTO', 'C,MANUAL', 'F,1', 'F,0', 'L,POT', 'L,WEB'];
    $validBrightness = preg_match('/^B,(?:[0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])$/', $command) === 1;
    if (!in_array($command, $allowed, true) && !$validBrightness) {
        reply(['error' => 'invalid_command'], 400);
    }
    $file = fopen($queuePath, 'c+');
    if ($file === false) reply(['error' => 'queue_unavailable'], 500);
    flock($file, LOCK_EX);
    fseek($file, 0, SEEK_END);
    fwrite($file, $command . "\n");
    fflush($file);
    flock($file, LOCK_UN);
    fclose($file);
    reply(['queued' => true]);
}

if ($action === 'next-command' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    $file = fopen($queuePath, 'c+');
    if ($file === false) reply(['command' => null]);
    flock($file, LOCK_EX);
    rewind($file);
    $lines = preg_split('/\r?\n/', stream_get_contents($file), -1, PREG_SPLIT_NO_EMPTY);
    $command = array_shift($lines);
    ftruncate($file, 0);
    rewind($file);
    if ($lines) fwrite($file, implode("\n", $lines) . "\n");
    fflush($file);
    flock($file, LOCK_UN);
    fclose($file);
    reply(['command' => $command ?: null]);
}

reply(['error' => 'not_found'], 404);
