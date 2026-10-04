package com.jnctf.repository;

import com.jnctf.domain.Attachment;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AttachmentRepository extends JpaRepository<Attachment, Long> {

    Page<Attachment> findAllByOrderByIdDesc(Pageable pageable);

    List<Attachment> findByUserIdOrderByIdDesc(Long userId);

    long countByUserId(Long userId);
}
