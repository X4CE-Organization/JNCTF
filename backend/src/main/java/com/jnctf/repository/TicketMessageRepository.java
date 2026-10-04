package com.jnctf.repository;

import com.jnctf.domain.TicketMessage;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TicketMessageRepository extends JpaRepository<TicketMessage, Long> {

    List<TicketMessage> findByTicketIdOrderByIdAsc(Long ticketId);

    List<TicketMessage> findByTicketIdAndInternalFalseOrderByIdAsc(Long ticketId);
}
