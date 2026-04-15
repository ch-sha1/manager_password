import React, {
    useState,
    useEffect,
    forwardRef,
    useImperativeHandle,
    useRef
} from 'react';
import { toast } from 'react-hot-toast';
import api from '../../services/api';
import PasswordCard from './PasswordCard';
import PasswordModal from './PasswordModal';
import SearchBar from '../Common/SearchBar';
import ConfirmModal from '../Common/ConfirmModal';

const PasswordList = forwardRef((props, ref) => {
    const [passwords, setPasswords] = useState([]);
    const [filteredPasswords, setFilteredPasswords] = useState([]);
    const [groups, setGroups] = useState([]);
    const [activeGroupFilter, setActiveGroupFilter] = useState('all');

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingPassword, setEditingPassword] = useState(null);

    const [showGroups, setShowGroups] = useState(true);

    const [showConfirm, setShowConfirm] = useState(false);
    const [passwordToDelete, setPasswordToDelete] = useState(null);

    const [selectedIds, setSelectedIds] = useState([]);
    const [draggingIds, setDraggingIds] = useState([]);
    const [dragOverGroupId, setDragOverGroupId] = useState(null);
    const [dragOverPasswordId, setDragOverPasswordId] = useState(null);

    const [searchQuery, setSearchQuery] = useState('');
    const [dropPosition, setDropPosition] = useState(null); // 'before' | null
    const [edgeDropZone, setEdgeDropZone] = useState(null); // 'start' | 'end' | null

    const hasLoadedRef = useRef(false);

    const getMasterPassword = () => {
        const mp = localStorage.getItem('masterPassword');
        if (!mp) {
            toast.error('Сессия истекла, пожалуйста, войдите снова');
            setTimeout(() => {
                window.location.href = '/';
            }, 1500);
            return null;
        }
        return mp;
    };

    const applyFilters = (passwordList, groupFilter = activeGroupFilter, query = searchQuery) => {
        let result = [...passwordList];

        if (groupFilter === 'ungrouped') {
            result = result.filter((p) => !p.group_id);
        } else if (groupFilter !== 'all') {
            result = result.filter((p) => p.group_id === Number(groupFilter));
        }

        if (query.trim()) {
            const q = query.toLowerCase();
            result = result.filter((p) =>
                p.site.toLowerCase().includes(q) ||
                p.login.toLowerCase().includes(q) ||
                (p.group_name || '').toLowerCase().includes(q)
            );
        }

        setFilteredPasswords(result);
    };

    const loadGroups = async () => {
        const response = await api.get('/passwords/groups');
        setGroups(response.data);
        return response.data;
    };

    const loadPasswords = async () => {
        try {
            const masterPassword = getMasterPassword();
            if (!masterPassword) return;

            const response = await api.get('/passwords', {
                params: { master_password: masterPassword }
            });

            setPasswords(response.data);
            applyFilters(response.data, activeGroupFilter, searchQuery);
        } catch (err) {
            console.error('Ошибка загрузки паролей:', err);
            toast.error(err.response?.data?.detail || 'Ошибка загрузки паролей');
        }
    };

    const loadAll = async () => {
        try {
            await Promise.all([loadGroups(), loadPasswords()]);
        } catch (err) {
            console.error(err);
        }
    };

    useImperativeHandle(ref, () => ({
        loadPasswords: loadAll
    }));

    useEffect(() => {
        if (hasLoadedRef.current) return;
        hasLoadedRef.current = true;
        loadAll();
    }, []);

    useEffect(() => {
        applyFilters(passwords, activeGroupFilter, searchQuery);
    }, [activeGroupFilter, passwords, searchQuery]);

    const handleSearch = (query) => {
        setSearchQuery(query);
        applyFilters(passwords, activeGroupFilter, query);
    };

    const handleAdd = () => {
        setEditingPassword(null);
        setIsModalOpen(true);
    };

    const handleEdit = (password) => {
        setEditingPassword(password);
        setIsModalOpen(true);
    };

    const handleCreateGroup = async (name) => {
        try {
            const response = await api.post('/passwords/groups', { name });
            setGroups((prev) => [...prev, response.data].sort((a, b) => a.name.localeCompare(b.name)));
            toast.success('Группа создана');
            return response.data;
        } catch (err) {
            console.error('Ошибка создания группы:', err);
            toast.error(err.response?.data?.detail || 'Ошибка создания группы');
            return null;
        }
    };

    const handleSave = async (passwordData) => {
        try {
            const masterPassword = getMasterPassword();
            if (!masterPassword) return;

            if (editingPassword) {
                await api.put(`/passwords/${editingPassword.id}`, passwordData, {
                    params: { master_password: masterPassword }
                });
                toast.success('Пароль обновлен');
            } else {
                await api.post('/passwords', passwordData, {
                    params: { master_password: masterPassword }
                });
                toast.success('Пароль добавлен');
            }

            await loadAll();
            setIsModalOpen(false);
            setEditingPassword(null);
        } catch (err) {
            console.error('Ошибка сохранения:', err);
            toast.error(err.response?.data?.detail || 'Ошибка сохранения пароля');
        }
    };

    const handleDeleteClick = (id) => {
        setPasswordToDelete(id);
        setShowConfirm(true);
    };

    const confirmDelete = async () => {
        try {
            await api.delete(`/passwords/${passwordToDelete}`);
            await loadAll();
            toast.success('Пароль удален');
            setShowConfirm(false);
            setPasswordToDelete(null);
            setSelectedIds((prev) => prev.filter((id) => id !== passwordToDelete));
        } catch (err) {
            console.error('Ошибка удаления:', err);
            toast.error(err.response?.data?.detail || 'Ошибка удаления');
        }
    };

    const toggleSelect = (id) => {
        setSelectedIds((prev) =>
            prev.includes(id)
                ? prev.filter((x) => x !== id)
                : [...prev, id]
        );
    };

    const clearSelection = () => {
        setSelectedIds([]);
    };

    const selectAllFiltered = () => {
        setSelectedIds(filteredPasswords.map((p) => p.id));
    };

    const handleBulkDelete = async () => {
        if (selectedIds.length === 0) {
            toast.error('Сначала выберите пароли');
            return;
        }

        try {
            await api.post('/passwords/bulk-delete', {
                ids: selectedIds
            });
            toast.success(`Удалено: ${selectedIds.length}`);
            setSelectedIds([]);
            await loadAll();
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.detail || 'Ошибка массового удаления');
        }
    };

    const handleBulkMove = async (groupId) => {
        if (selectedIds.length === 0) {
            toast.error('Сначала выберите пароли');
            return;
        }

        try {
            await api.post('/passwords/bulk-move', {
                ids: selectedIds,
                group_id: groupId === '' ? null : Number(groupId)
            });
            toast.success(`Перемещено: ${selectedIds.length}`);
            setSelectedIds([]);
            await loadAll();
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.detail || 'Ошибка перемещения');
        }
    };

    const handleShare = async (password) => {
        const masterPassword = getMasterPassword();
        if (!masterPassword) return;

        try {
            const response = await api.post('/passwords/bulk-share', {
                ids: [password.id]
            }, {
                params: { master_password: masterPassword }
            });

            await navigator.clipboard.writeText(response.data.text);
            toast.success('Данные пароля скопированы');
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.detail || 'Ошибка при копировании');
        }
    };

    const handleBulkShare = async () => {
        const masterPassword = getMasterPassword();
        if (!masterPassword) return;

        if (selectedIds.length === 0) {
            toast.error('Сначала выберите пароли');
            return;
        }

        try {
            const response = await api.post('/passwords/bulk-share', {
                ids: selectedIds
            }, {
                params: { master_password: masterPassword }
            });

            await navigator.clipboard.writeText(response.data.text);
            toast.success(`Скопировано ${selectedIds.length} паролей`);
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.detail || 'Ошибка при массовом копировании');
        }
    };

    const handleStartDrag = (passwordId) => {
        if (selectedIds.includes(passwordId) && selectedIds.length > 1) {
            const orderedSelectedIds = passwords
                .filter((p) => selectedIds.includes(p.id))
                .map((p) => p.id);
            setDraggingIds(orderedSelectedIds);
        } else {
            setDraggingIds([passwordId]);
        }
    };

    const resetDragState = () => {
        setDraggingIds([]);
        setDragOverGroupId(null);
        setDragOverPasswordId(null);
        setDropPosition(null);
        setEdgeDropZone(null);
    };

    const handleDropToGroup = async (groupId) => {
        const idsToMove = draggingIds.length ? draggingIds : selectedIds;
        if (!idsToMove.length) return;

        try {
            await api.post('/passwords/bulk-move', {
                ids: idsToMove,
                group_id: groupId
            });
            toast.success(`Перемещено: ${idsToMove.length}`);
            resetDragState();
            await loadAll();
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.detail || 'Ошибка перемещения в группу');
        }
    };

    const handleDropToUngrouped = async () => {
        const idsToMove = draggingIds.length ? draggingIds : selectedIds;
        if (!idsToMove.length) return;

        try {
            await api.post('/passwords/bulk-move', {
                ids: idsToMove,
                group_id: null
            });
            toast.success(`Перемещено: ${idsToMove.length} в "Без группы"`);
            resetDragState();
            await loadAll();
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.detail || 'Ошибка перемещения');
        }
    };

    const buildReorderedIds = (dragIds, targetId, position = 'before') => {
        const orderedAllIds = passwords.map((p) => p.id);
        const draggedSet = new Set(dragIds);

        if (!orderedAllIds.includes(targetId)) {
            return orderedAllIds;
        }

        if (draggedSet.has(targetId)) {
            return orderedAllIds;
        }

        const draggedBlock = orderedAllIds.filter((id) => draggedSet.has(id));
        const remaining = orderedAllIds.filter((id) => !draggedSet.has(id));

        const targetIndex = remaining.indexOf(targetId);
        if (targetIndex === -1) {
            return orderedAllIds;
        }

        const insertIndex = position === 'after' ? targetIndex + 1 : targetIndex;

        const result = [...remaining];
        result.splice(insertIndex, 0, ...draggedBlock);
        return result;
    };

    const buildReorderedToEdge = (dragIds, edge) => {
        const orderedAllIds = passwords.map((p) => p.id);
        const draggedSet = new Set(dragIds);

        const draggedBlock = orderedAllIds.filter((id) => draggedSet.has(id));
        const remaining = orderedAllIds.filter((id) => !draggedSet.has(id));

        return edge === 'start'
            ? [...draggedBlock, ...remaining]
            : [...remaining, ...draggedBlock];
    };

    const submitReorder = async (orderedIds) => {
        const sameOrder =
            orderedIds.length === passwords.length &&
            orderedIds.every((id, index) => id === passwords[index].id);

        if (sameOrder) {
            resetDragState();
            return;
        }

        await api.post('/passwords/reorder', { ordered_ids: orderedIds });

        toast.success(
            draggingIds.length > 1
                ? `Перемещено ${draggingIds.length} паролей`
                : 'Порядок обновлен'
        );

        resetDragState();
        await loadAll();
    };

    const handleCardDropReorder = async (targetId) => {
        if (!draggingIds.length) return;

        try {
            const orderedIds = buildReorderedIds(
                draggingIds,
                targetId,
                dropPosition || 'before'
            );
            await submitReorder(orderedIds);
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.detail || 'Ошибка изменения порядка');
        }
    };

    const handleEdgeDropReorder = async (edge) => {
        if (!draggingIds.length) return;

        try {
            const orderedIds = buildReorderedToEdge(draggingIds, edge);
            await submitReorder(orderedIds);
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.detail || 'Ошибка изменения порядка');
        }
    };

    return (
        <div className="password-list">
            <div className="list-header">
                <h2>Мои пароли</h2>
                <div className="list-header-actions">
                    <button onClick={handleAdd} className="add-btn">+ Добавить</button>
                    <button onClick={selectAllFiltered} className="secondary-btn">Выделить всё</button>
                    <button onClick={clearSelection} className="secondary-btn">Сбросить</button>
                </div>
            </div>

            <SearchBar onSearch={handleSearch} />

            <div className="groups-bar">
                <button
                    className="groups-toggle"
                    onClick={() => setShowGroups(!showGroups)}
                >
                    Группы {showGroups ? '▼' : '▶'}
                </button>

                {showGroups && (
                    <div className="groups-list">
                        <button
                            className={activeGroupFilter === 'all' ? 'active' : ''}
                            onClick={() => setActiveGroupFilter('all')}
                        >
                            Все
                        </button>

                        <button
                            className={activeGroupFilter === 'ungrouped' ? 'active' : ''}
                            onClick={() => setActiveGroupFilter('ungrouped')}
                            onDragOver={(e) => {
                                e.preventDefault();
                                setDragOverGroupId('ungrouped');
                            }}
                            onDragLeave={() => setDragOverGroupId(null)}
                            onDrop={(e) => {
                                e.preventDefault();
                                handleDropToUngrouped();
                            }}
                        >
                            Без группы
                            {dragOverGroupId === 'ungrouped' ? ' ← отпустить' : ''}
                        </button>

                        {groups.map((group) => (
                            <button
                                key={group.id}
                                className={`${activeGroupFilter === group.id ? 'active' : ''} ${dragOverGroupId === group.id ? 'drag-over' : ''}`}
                                onClick={() => setActiveGroupFilter(group.id)}
                                onDragOver={(e) => {
                                    e.preventDefault();
                                    setDragOverGroupId(group.id);
                                }}
                                onDragLeave={() => setDragOverGroupId(null)}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    handleDropToGroup(group.id);
                                }}
                                title="Можно перетащить один или несколько выбранных паролей"
                            >
                                {group.name}
                                {dragOverGroupId === group.id ? ' ← отпустить' : ''}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {selectedIds.length > 0 && (
                <div className="bulk-toolbar">
                    <div className="bulk-info">
                        Выбрано: <strong>{selectedIds.length}</strong>
                    </div>

                    <div className="bulk-actions">
                        <select
                            defaultValue="__placeholder__"
                            onChange={(e) => {
                                const value = e.target.value;
                                if (value === '__placeholder__') return;
                                handleBulkMove(value === '__ungrouped__' ? '' : value);
                                e.target.value = '__placeholder__';
                            }}
                        >
                            <option value="__placeholder__" disabled>Переместить в группу</option>
                            <option value="__ungrouped__">Без группы</option>
                            {groups.map((group) => (
                                <option key={group.id} value={group.id}>
                                    {group.name}
                                </option>
                            ))}
                        </select>

                        <button onClick={handleBulkShare} className="secondary-btn">
                            Поделиться
                        </button>

                        <button onClick={handleBulkDelete} className="danger-btn">
                            Удалить
                        </button>
                    </div>
                </div>
            )}

            <div
                className={`edge-drop-zone ${edgeDropZone === 'start' ? 'active' : ''}`}
                onDragOver={(e) => {
                    e.preventDefault();
                    setEdgeDropZone('start');
                    setDragOverPasswordId(null);
                    setDropPosition(null);
                }}
                onDragLeave={() => {
                    setEdgeDropZone((current) => current === 'start' ? null : current);
                }}
                onDrop={(e) => {
                    e.preventDefault();
                    handleEdgeDropReorder('start');
                }}
            />

            <div className="drag-hint">
                Перетащите карточку или выделенные карточки, чтобы изменить порядок или перенести их в группу.
            </div>

            <div className="passwords-grid">
                {filteredPasswords.map((pwd) => (
                    <div
                        key={pwd.id}
                        className={
                            dragOverPasswordId === pwd.id
                                ? `drop-target-wrapper ${dropPosition === 'after' ? 'drop-after' : 'drop-before'}`
                                : ''
                        }
                        onDragOver={(e) => {
                            e.preventDefault();
                            setEdgeDropZone(null);

                            const rect = e.currentTarget.getBoundingClientRect();
                            const offsetY = e.clientY - rect.top;
                            const position = offsetY < rect.height / 2 ? 'before' : 'after';

                            setDragOverPasswordId(pwd.id);
                            setDropPosition(position);
                        }}
                        onDragLeave={() => {
                            setDragOverPasswordId((current) => current === pwd.id ? null : current);
                            setDropPosition(null);
                        }}
                        onDrop={(e) => {
                            e.preventDefault();
                            handleCardDropReorder(pwd.id);
                        }}
                    >
                        <PasswordCard
                            password={pwd}
                            onEdit={handleEdit}
                            onDelete={handleDeleteClick}
                            onShare={handleShare}
                            isSelected={selectedIds.includes(pwd.id)}
                            onToggleSelect={toggleSelect}
                            onStartDrag={handleStartDrag}
                        />
                    </div>
                ))}
            </div>

            <div
                className={`edge-drop-zone ${edgeDropZone === 'end' ? 'active' : ''}`}
                onDragOver={(e) => {
                    e.preventDefault();
                    setEdgeDropZone('end');
                    setDragOverPasswordId(null);
                    setDropPosition(null);
                }}
                onDragLeave={() => {
                    setEdgeDropZone((current) => current === 'end' ? null : current);
                }}
                onDrop={(e) => {
                    e.preventDefault();
                    handleEdgeDropReorder('end');
                }}
            />

            <PasswordModal
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false);
                    setEditingPassword(null);
                }}
                onSave={handleSave}
                password={editingPassword}
                groups={groups}
                onCreateGroup={handleCreateGroup}
            />

            <ConfirmModal
                isOpen={showConfirm}
                onClose={() => {
                    setShowConfirm(false);
                    setPasswordToDelete(null);
                }}
                onConfirm={confirmDelete}
                title="Удаление пароля"
                message="Вы уверены, что хотите удалить этот пароль?"
            />
        </div>
    );
});

export default PasswordList;