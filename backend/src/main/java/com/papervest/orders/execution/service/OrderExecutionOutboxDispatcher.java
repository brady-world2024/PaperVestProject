package com.papervest.orders.execution.service;

import com.papervest.orders.execution.config.OrderExecutionProperties;
import com.papervest.orders.execution.messaging.OrderExecutionMessagePublisher;
import com.papervest.orders.execution.model.OrderExecutionRequest;
import com.papervest.orders.execution.model.OrderExecutionRequestStatus;
import com.papervest.orders.execution.repository.OrderExecutionRequestRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.List;
import java.util.UUID;

@Service
public class OrderExecutionOutboxDispatcher {

	private static final Logger log = LoggerFactory.getLogger(OrderExecutionOutboxDispatcher.class);

	private final OrderExecutionProperties properties;
	private final OrderExecutionRequestRepository requestRepository;
	private final OrderExecutionMessagePublisher publisher;
	private final TransactionTemplate transactionTemplate;

	public OrderExecutionOutboxDispatcher(
			OrderExecutionProperties properties,
			OrderExecutionRequestRepository requestRepository,
			OrderExecutionMessagePublisher publisher,
			PlatformTransactionManager transactionManager
	) {
		this.properties = properties;
		this.requestRepository = requestRepository;
		this.publisher = publisher;
		this.transactionTemplate = new TransactionTemplate(transactionManager);
	}

	public int dispatchPendingRequests() {
		List<OrderExecutionRequest> pending = requestRepository.findPendingForDispatch(
				OrderExecutionRequestStatus.PENDING,
				PageRequest.of(0, properties.dispatcher().batchSize())
		);
		int published = 0;
		for (OrderExecutionRequest request : pending) {
			if (dispatchOne(request.getId())) {
				published++;
			}
		}
		return published;
	}

	protected boolean dispatchOne(UUID requestId) {
		return Boolean.TRUE.equals(transactionTemplate.execute(status -> {
			OrderExecutionRequest request = requestRepository.findByIdForUpdate(requestId).orElse(null);
			if (request == null || request.getStatus() != OrderExecutionRequestStatus.PENDING) {
				return false;
			}
			try {
				publisher.publish(request);
				request.markPublished();
				return true;
			}
			catch (RuntimeException ex) {
				request.markPublishAttemptFailed(ex.getMessage());
				log.warn(
						"Order execution publish failed requestId={} orderId={} message={}",
						request.getId(),
						request.getOrderId(),
						ex.getMessage()
				);
				return false;
			}
		}));
	}
}
