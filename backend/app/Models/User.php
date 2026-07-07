<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    // Roles (V1 parity: only 'admin' is privileged)
    const ROLE_ADMIN     = 'admin';
    const ROLE_SALES_REP = 'sales_rep';
    const ROLE_MANAGER   = 'manager';

    const ROLES = [self::ROLE_ADMIN, self::ROLE_SALES_REP, self::ROLE_MANAGER];

    protected $fillable = [
        'username',
        'full_name',
        'email',
        'password',
        'role',
        'last_login',
        'can_create_payment_links',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'password'   => 'hashed',
            'last_login' => 'datetime',
            'can_create_payment_links' => 'boolean',
        ];
    }

    public function isAdmin(): bool
    {
        return $this->role === self::ROLE_ADMIN;
    }

    // Admins always can; others only if the switch is flipped on for them.
    public function canCreatePaymentLinks(): bool
    {
        return $this->isAdmin() || (bool) $this->can_create_payment_links;
    }

    // Managers/account managers/viewers see the whole book of business;
    // quote makers and sales reps see their own quotes only.
    public function seesAllQuotes(): bool
    {
        return in_array($this->role, ['admin', 'manager', 'account_manager', 'viewer'], true);
    }

    // Viewers are strictly read-only — every write endpoint refuses them.
    public function isViewer(): bool
    {
        return $this->role === 'viewer';
    }

    // Quotes this user created
    public function quotes()
    {
        return $this->hasMany(Quote::class, 'created_by');
    }

    // V1 to_dict() parity
    public function toApi(): array
    {
        return [
            'id'         => $this->id,
            'username'   => $this->username,
            'full_name'  => $this->full_name,
            'email'      => $this->email ?? '',
            'role'       => $this->role,
            'can_create_payment_links' => $this->canCreatePaymentLinks(),
            'last_login' => $this->last_login?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
