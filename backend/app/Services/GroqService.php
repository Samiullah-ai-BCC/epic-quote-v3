<?php

namespace App\Services;

use GuzzleHttp\Client;
use RuntimeException;

/**
 * Groq OpenAI-compatible chat completion (V1 call_groq).
 * Text model for text-only context; vision model when an image data URL is supplied.
 */
class GroqService
{
    private const URL = 'https://api.groq.com/openai/v1/chat/completions';

    public function chat(string $prompt, ?string $imageDataUrl = null, bool $jsonMode = false): string
    {
        $apiKey = config('services.groq.key');
        if (!$apiKey) {
            throw new RuntimeException('GROQ_API_KEY is not configured on the server (.env)');
        }

        if ($imageDataUrl) {
            $content = [
                ['type' => 'text', 'text' => $prompt],
                ['type' => 'image_url', 'image_url' => ['url' => $imageDataUrl]],
            ];
            $model = config('services.groq.vision_model');
        } else {
            $content = $prompt;
            $model = config('services.groq.model');
        }

        $body = [
            'model'       => $model,
            'messages'    => [['role' => 'user', 'content' => $content]],
            'temperature' => 0.2,
            'max_tokens'  => 2000,
        ];
        // JSON mode guarantees valid, properly-escaped JSON (handles inch-marks etc.).
        // Only for text calls — some vision models reject response_format.
        if ($jsonMode && !$imageDataUrl) {
            $body['response_format'] = ['type' => 'json_object'];
        }

        $client = new Client(['timeout' => 60]);
        $res = $client->post(self::URL, [
            'headers' => [
                'Authorization' => "Bearer {$apiKey}",
                'Content-Type'  => 'application/json',
            ],
            'json' => $body,
        ]);

        $data = json_decode((string) $res->getBody(), true);
        return $data['choices'][0]['message']['content'] ?? '';
    }
}
