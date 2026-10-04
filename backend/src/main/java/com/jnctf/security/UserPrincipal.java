package com.jnctf.security;

import com.jnctf.domain.User;
import com.jnctf.domain.UserRole;
import com.jnctf.domain.UserStatus;
import lombok.Getter;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Collection;
import java.util.List;

/**
 * Spring Security 里的当前登录用户。
 */
@Getter
public class UserPrincipal implements UserDetails {

    private final Long id;
    private final String username;
    private final String password;
    private final UserRole role;
    private final UserStatus status;
    private final boolean banned;

    public UserPrincipal(User user) {
        this.id = user.getId();
        this.username = user.getUsername();
        this.password = user.getPasswordHash();
        this.role = user.getRole();
        this.status = user.getStatus();
        this.banned = Boolean.TRUE.equals(user.getBanned());
    }

    public boolean isAdmin() {
        return role != null && role.isAdmin();
    }

    public boolean isSuperAdmin() {
        return role == UserRole.SUPER_ADMIN;
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return List.of(new SimpleGrantedAuthority("ROLE_" + (role == null ? "USER" : role.name())));
    }

    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    @Override
    public boolean isAccountNonLocked() {
        return !banned;
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    @Override
    public boolean isEnabled() {
        return status != UserStatus.BANNED && !banned;
    }
}
