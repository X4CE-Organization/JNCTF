package com.jnctf.repository;

import com.jnctf.domain.User;
import com.jnctf.domain.UserRole;
import com.jnctf.domain.UserStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByUsername(String username);

    Optional<User> findByEmail(String email);

    Optional<User> findByUsernameOrEmail(String username, String email);

    boolean existsByUsername(String username);

    boolean existsByEmail(String email);

    List<User> findTop20ByHiddenFalseOrderByScoreDesc();

    long countByRole(UserRole role);

    long countByStatus(UserStatus status);

    @Query("""
            select u from User u
            where (:keyword = '' or lower(u.username) like lower(concat('%', :keyword, '%'))
                   or lower(u.email) like lower(concat('%', :keyword, '%'))
                   or lower(u.displayName) like lower(concat('%', :keyword, '%')))
              and (:role is null or u.role = :role)
              and (:status is null or u.status = :status)
            """)
    Page<User> search(@Param("keyword") String keyword,
                      @Param("role") UserRole role,
                      @Param("status") UserStatus status,
                      Pageable pageable);
}
