<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * The sign-in code message.
 *
 * A Mailable rather than Mail::raw() for two reasons that both matter here: the fake can assert it
 * was sent (a security path that is only "probably delivered" is not tested), and the wording of a
 * message asking someone for a code lives in one reviewable place instead of inside a controller.
 *
 * SENT SYNCHRONOUSLY, not queued: the person is waiting on the login screen, and this app runs no
 * queue worker — a queued code would sit in the jobs table forever.
 */
class TwoFactorCodeMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public string $code,
        public string $name,
        public int $minutes,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: 'Your Epic Craftings sign-in code');
    }

    public function content(): Content
    {
        // Plain text on purpose. It renders in every client, cannot leak the code through a remote
        // image, and gives a phishing filter nothing to object to.
        return new Content(text: 'mail.two-factor-code');
    }
}
