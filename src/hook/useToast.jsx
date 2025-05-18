import * as React from "react";

const TOAST_LIMIT = 1; // Số lượng toast tối đa hiển thị cùng lúc (ở đây là 1)
const TOAST_REMOVE_DELAY = 1000000; // Thời gian tồn tại của toast trước khi bị xóa (ở đây là 1 triệu mili giây = 1000 giây = 16 phút)

// Tạo biến đếm để sinh ra "id" duy nhất cho mỗi toast, sẽ được tạo ra từ hàm genId()
let count = 0;
function genId() {
	count = (count + 1) % Number.MAX_SAFE_INTEGER;
	return count.toString();
}

// Tạo một Map để lưu trữ các toast để quản lý việc xóa toast sau một khoảng thời gian.
const toastTimeouts = new Map();

// Hàm này sẽ được gọi khi một toast cần được xóa sau một khoảng thời gian nhất định.
const addToRemoveQueue = (toastId) => {
	// Nếu toast đã có trong hàng đợi thì không làm gì.
	if (toastTimeouts.has(toastId)) {
		return;
	}

	// Nếu toast không có trong hàng đợi thì thêm nó vào hàng đợi và thiết lập thời gian xóa.
	const timeout = setTimeout(() => {
		toastTimeouts.delete(toastId);
		dispatch({
			type: "REMOVE_TOAST",
			toastId: toastId,
		});
	}, TOAST_REMOVE_DELAY);

	toastTimeouts.set(toastId, timeout);
};

// Hàm reducer quản lý trạng thái toast dựa trên các action
/**
 * "ADD_TOAST": Thêm một toast mới vào danh sách, giới hạn số lượng.
 * "UPDATE_TOAST": Cập nhật thông tin của một toast đã tồn tại.
 * "DISMISS_TOAST": Đánh dấu toast là đã đóng (open: false) và thêm vào hàng đợi xóa.
 * "REMOVE_TOAST": Xóa một toast khỏi danh sách.
 */
const reducer = (state, action) => {
	switch (action.type) {
		case "ADD_TOAST":
			return {
				...state,
				toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
			};

		case "UPDATE_TOAST":
			return {
				...state,
				toasts: state.toasts.map((t) =>
					t.id === action.toast.id ? { ...t, ...action.toast } : t
				),
			};

		case "DISMISS_TOAST": {
			const { toastId } = action;

			if (toastId) {
				addToRemoveQueue(toastId);
			} else {
				state.toasts.forEach((toast) => {
					addToRemoveQueue(toast.id);
				});
			}

			return {
				...state,
				toasts: state.toasts.map((t) =>
					t.id === toastId || toastId === undefined
						? {
								...t,
								open: false,
						  }
						: t
				),
			};
		}
		case "REMOVE_TOAST":
			if (action.toastId === undefined) {
				return {
					...state,
					toasts: [],
				};
			}
			return {
				...state,
				toasts: state.toasts.filter((t) => t.id !== action.toastId),
			};
	}
};

const listeners = []; // Danh sách các hàm sẽ được gọi khi trạng thái thay đổi.
let memoryState = { toasts: [] }; // Trạng thái hiện tại của các toast (dùng ngoài React state).

// Hàm này sẽ được gọi để cập nhật trạng thái và thông báo cho tất cả các listener.
// Nó sẽ gọi reducer để cập nhật trạng thái và sau đó gọi tất cả các listener với trạng thái mới.
function dispatch(action) {
	memoryState = reducer(memoryState, action);
	listeners.forEach((listener) => {
		listener(memoryState);
	});
}

// Hàm toast sẽ được gọi để tạo một toast mới.
/**
 * Trả về object có id, dismiss và update.
 * id: id của toast
 * dismiss: hàm để đóng toast
 * update: hàm để cập nhật toast
 */
function toast(props) {
	const id = genId();

	const update = (props) =>
		dispatch({
			type: "UPDATE_TOAST",
			toast: { ...props, id },
		});
	const dismiss = () => dispatch({ type: "DISMISS_TOAST", toastId: id });

	dispatch({
		type: "ADD_TOAST",
		toast: {
			...props,
			id,
			open: true,
			onOpenChange: (open) => {
				if (!open) dismiss();
			},
		},
	});

	return {
		id: id,
		dismiss,
		update,
	};
}

// Hook useToast sẽ được sử dụng trong các component để lấy trạng thái toast và hàm toast.
// Nó sẽ thêm một listener vào danh sách và trả về "state" hiện tại của toast và hàm toast.
function useToast() {
	const [state, setState] = React.useState(memoryState);

	React.useEffect(() => {
		listeners.push(setState);
		return () => {
			const index = listeners.indexOf(setState);
			if (index > -1) {
				listeners.splice(index, 1);
			}
		};
	}, [state]);

	return {
		...state,
		toast,
		dismiss: (toastId) => dispatch({ type: "DISMISS_TOAST", toastId }),
	};
}

export { useToast, toast };
