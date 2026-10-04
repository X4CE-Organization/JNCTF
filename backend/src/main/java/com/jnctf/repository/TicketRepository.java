package com.jnctf.repository;

import com.jnctf.domain.Ticket;
import com.jnctf.domain.TicketStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TicketRepository extends JpaRepository<Ticket, Long> {

    Page<Ticket> findByUserIdOrderByLastReplyAtDescIdDesc(Long userId, Pageable pageable);

    long countByStatus(TicketStatus status);

    long countByUserId(Long userId);

    @Query("""
            select t from Ticket t
            where (:keyword = '' or lower(t.subject) like lower(concat('%', :keyword, '%')))
              and (:status is null or t.status = :status)
              and (:assigneeId is null or t.assigneeId = :assigneeId)
            """)
    Page<Ticket> search(@Param("keyword") String keyword,
                        @Param("status") TicketStatus status,
                        @Param("assigneeId") Long assigneeId,
                        Pageable pageable);
}
