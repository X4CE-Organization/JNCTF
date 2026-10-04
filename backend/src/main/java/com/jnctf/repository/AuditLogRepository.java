package com.jnctf.repository;

import com.jnctf.domain.AuditLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AuditLogRepository extends JpaRepository<AuditLog, Long> {

    Page<AuditLog> findAllByOrderByIdDesc(Pageable pageable);

    @Query("""
            select a from AuditLog a
            where (:keyword = '' or lower(a.action) like lower(concat('%', :keyword, '%'))
                   or lower(a.actorName) like lower(concat('%', :keyword, '%')))
            """)
    Page<AuditLog> search(@Param("keyword") String keyword, Pageable pageable);
}
