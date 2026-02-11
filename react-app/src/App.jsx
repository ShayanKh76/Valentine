import { forwardRef, useEffect, useMemo, useState } from "react";
import { Heart, Sparkles } from "lucide-react";
import HTMLFlipBook from "react-pageflip";
import {
  createBlock,
  createPage,
  deleteBlock,
  deletePage,
  getBlocks,
  getPages,
  uploadImage,
  updateBlock,
  updatePage,
} from "./api/items";

const BookPage = forwardRef(function BookPage({ className = "", children }, ref) {
  return (
    <div ref={ref} className={`book-page ${className}`.trim()}>
      <div className="book-page__content">{children}</div>
    </div>
  );
});

function ManagePageCard({
  page,
  blocks,
  pageTitleDraft,
  blockDraft,
  editingBlock,
  loading,
  error,
  uploadingDraftImage,
  uploadingEditingImage,
  onPageTitleDraftChange,
  onSavePageTitle,
  onDeletePage,
  onBlockDraftChange,
  onAddBlock,
  onUploadDraftImage,
  onEditBlockStart,
  onEditBlockChange,
  onEditBlockSave,
  onEditBlockCancel,
  onUploadEditingImage,
  onDeleteBlock,
}) {
  return (
    <article className="manage-card">
      <div className="manage-card__header">
        <input
          className="item-input"
          value={pageTitleDraft}
          onChange={(event) => onPageTitleDraftChange(page.id, event.target.value)}
          placeholder="Page title"
        />
        <button className="item-btn item-btn--ghost" onClick={() => onSavePageTitle(page.id)}>
          Save Title
        </button>
        <button className="item-btn item-btn--danger" onClick={() => onDeletePage(page.id)}>
          Delete Page
        </button>
      </div>

      <form
        className="item-form"
        onSubmit={(event) => {
          event.preventDefault();
          onAddBlock(page.id);
        }}
      >
        <select
          className="item-input item-input--select"
          value={blockDraft.blockType}
          onChange={(event) =>
            onBlockDraftChange(page.id, { ...blockDraft, blockType: event.target.value })
          }
        >
          <option value="text">Text</option>
          <option value="image">Image URL</option>
        </select>
        <input
          className="item-input"
          value={blockDraft.content}
          onChange={(event) =>
            onBlockDraftChange(page.id, { ...blockDraft, content: event.target.value })
          }
          placeholder={
            blockDraft.blockType === "image" ? "https://image-url..." : "Write page text..."
          }
        />
        <button type="submit" className="item-btn">
          Add
        </button>
      </form>
      {blockDraft.blockType === "image" ? (
        <div className="upload-inline">
          <input
            type="file"
            accept="image/*"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              onUploadDraftImage(page.id, file);
              event.target.value = "";
            }}
          />
          <span className="items-meta">
            {uploadingDraftImage ? "Uploading..." : "Or upload an image file"}
          </span>
        </div>
      ) : null}

      {loading ? <p className="items-meta">Loading...</p> : null}
      {error ? <p className="items-error">{error}</p> : null}

      <div className="blocks-list">
        {blocks.map((block) =>
          editingBlock?.id === block.id ? (
            <form
              className="item-edit-form"
              key={block.id}
              onSubmit={(event) => {
                event.preventDefault();
                onEditBlockSave(page.id);
              }}
            >
              <select
                className="item-input item-input--select"
                value={editingBlock.blockType}
                onChange={(event) =>
                  onEditBlockChange(page.id, {
                    ...editingBlock,
                    blockType: event.target.value,
                  })
                }
              >
                <option value="text">Text</option>
                <option value="image">Image URL</option>
              </select>
              <input
                className="item-input"
                value={editingBlock.content}
                onChange={(event) =>
                  onEditBlockChange(page.id, {
                    ...editingBlock,
                    content: event.target.value,
                  })
                }
              />
              <button className="item-btn" type="submit">
                Save
              </button>
              <button
                className="item-btn item-btn--ghost"
                type="button"
                onClick={() => onEditBlockCancel(page.id)}
              >
                Cancel
              </button>
              {editingBlock.blockType === "image" ? (
                <div className="upload-inline">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      onUploadEditingImage(page.id, file);
                      event.target.value = "";
                    }}
                  />
                  <span className="items-meta">
                    {uploadingEditingImage ? "Uploading..." : "Upload file"}
                  </span>
                </div>
              ) : null}
            </form>
          ) : (
            <div className="block-row" key={block.id}>
              <span className="block-tag">{block.blockType}</span>
              {block.blockType === "image" ? (
                <img src={block.content} alt="" className="block-thumb" loading="lazy" />
              ) : (
                <span className="item-content">{block.content}</span>
              )}
              <div className="item-actions">
                <button
                  type="button"
                  className="item-btn item-btn--ghost"
                  onClick={() => onEditBlockStart(page.id, block)}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="item-btn item-btn--danger"
                  onClick={() => onDeleteBlock(page.id, block.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          )
        )}
      </div>
    </article>
  );
}

function App() {
  const { hearts, sparkles } = useMemo(() => {
    const randomRange = (min, max) => min + Math.random() * (max - min);
    return {
      hearts: Array.from({ length: 30 }, (_, index) => ({
        id: `heart-${index}`,
        left: randomRange(0, 100),
        top: randomRange(0, 100),
        size: randomRange(20, 50),
        duration: randomRange(4, 6),
        delay: randomRange(0, 3),
      })),
      sparkles: Array.from({ length: 15 }, (_, index) => ({
        id: `sparkle-${index}`,
        left: randomRange(0, 100),
        top: randomRange(0, 100),
        size: randomRange(16, 32),
        duration: randomRange(3, 4),
        delay: randomRange(0, 2),
      })),
    };
  }, []);

  const [pathname, setPathname] = useState(() => {
    const current = window.location.pathname.replace(/\/+$/, "");
    return current || "/";
  });
  const [pages, setPages] = useState([]);
  const [blocksByPage, setBlocksByPage] = useState({});
  const [loadingByPage, setLoadingByPage] = useState({});
  const [errorByPage, setErrorByPage] = useState({});
  const [uploadingDraftByPage, setUploadingDraftByPage] = useState({});
  const [uploadingEditByPage, setUploadingEditByPage] = useState({});
  const [newPageTitle, setNewPageTitle] = useState("");
  const [pageTitleDrafts, setPageTitleDrafts] = useState({});
  const [blockDrafts, setBlockDrafts] = useState({});
  const [editingBlocks, setEditingBlocks] = useState({});

  useEffect(() => {
    const onPopState = () => {
      const current = window.location.pathname.replace(/\/+$/, "");
      setPathname(current || "/");
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    const shouldLockScroll = pathname !== "/manage";
    document.body.classList.toggle("no-scroll", shouldLockScroll);
    return () => document.body.classList.remove("no-scroll");
  }, [pathname]);

  useEffect(() => {
    async function loadData() {
      try {
        const loadedPages = await getPages();
        setPages(loadedPages);
        setPageTitleDrafts(
          loadedPages.reduce((acc, page) => ({ ...acc, [page.id]: page.title }), {})
        );
        setBlockDrafts(
          loadedPages.reduce(
            (acc, page) => ({ ...acc, [page.id]: { blockType: "text", content: "" } }),
            {}
          )
        );

        await Promise.all(
          loadedPages.map(async (page) => {
            setLoadingByPage((current) => ({ ...current, [page.id]: true }));
            setErrorByPage((current) => ({ ...current, [page.id]: "" }));
            try {
              const blocks = await getBlocks(page.id);
              setBlocksByPage((current) => ({ ...current, [page.id]: blocks }));
            } catch (error) {
              setErrorByPage((current) => ({ ...current, [page.id]: error.message }));
            } finally {
              setLoadingByPage((current) => ({ ...current, [page.id]: false }));
            }
          })
        );
      } catch (error) {
        console.error(error);
      }
    }

    loadData();
  }, []);

  async function handleAddPage() {
    const title = newPageTitle.trim();

    try {
      const created = await createPage(title);
      setPages((current) => [...current, created]);
      setPageTitleDrafts((current) => ({ ...current, [created.id]: created.title }));
      setBlockDrafts((current) => ({
        ...current,
        [created.id]: { blockType: "text", content: "" },
      }));
      setBlocksByPage((current) => ({ ...current, [created.id]: [] }));
      setNewPageTitle("");
    } catch (error) {
      console.error(error);
    }
  }

  async function handleSavePageTitle(pageId) {
    const title = String(pageTitleDrafts[pageId] || "").trim();

    try {
      const updated = await updatePage(pageId, { title });
      setPages((current) =>
        current.map((page) => (page.id === pageId ? { ...page, title: updated.title } : page))
      );
    } catch (error) {
      setErrorByPage((current) => ({ ...current, [pageId]: error.message }));
    }
  }

  async function handleDeletePage(pageId) {
    try {
      await deletePage(pageId);
      setPages((current) => current.filter((page) => page.id !== pageId));
      setBlocksByPage((current) => {
        const next = { ...current };
        delete next[pageId];
        return next;
      });
    } catch (error) {
      setErrorByPage((current) => ({ ...current, [pageId]: error.message }));
    }
  }

  async function handleAddBlock(pageId) {
    const draft = blockDrafts[pageId] || { blockType: "text", content: "" };
    const content = draft.content.trim();
    if (!content) return;

    try {
      const created = await createBlock(pageId, {
        blockType: draft.blockType,
        content,
      });
      setBlocksByPage((current) => ({
        ...current,
        [pageId]: [...(current[pageId] || []), created],
      }));
      setBlockDrafts((current) => ({
        ...current,
        [pageId]: { ...draft, content: "" },
      }));
    } catch (error) {
      setErrorByPage((current) => ({ ...current, [pageId]: error.message }));
    }
  }

  async function handleUploadDraftImage(pageId, file) {
    try {
      setUploadingDraftByPage((current) => ({ ...current, [pageId]: true }));
      const result = await uploadImage(file);
      setBlockDrafts((current) => ({
        ...current,
        [pageId]: { ...(current[pageId] || { blockType: "image", content: "" }), content: result.url, blockType: "image" },
      }));
      setErrorByPage((current) => ({ ...current, [pageId]: "" }));
    } catch (error) {
      setErrorByPage((current) => ({ ...current, [pageId]: error.message }));
    } finally {
      setUploadingDraftByPage((current) => ({ ...current, [pageId]: false }));
    }
  }

  function handleEditBlockStart(pageId, block) {
    setEditingBlocks((current) => ({
      ...current,
      [pageId]: {
        id: block.id,
        blockType: block.blockType,
        content: block.content,
        sortOrder: block.sortOrder,
      },
    }));
  }

  function handleEditBlockCancel(pageId) {
    setEditingBlocks((current) => ({ ...current, [pageId]: null }));
  }

  async function handleUploadEditingImage(pageId, file) {
    try {
      setUploadingEditByPage((current) => ({ ...current, [pageId]: true }));
      const result = await uploadImage(file);
      setEditingBlocks((current) => ({
        ...current,
        [pageId]: {
          ...(current[pageId] || {}),
          blockType: "image",
          content: result.url,
        },
      }));
      setErrorByPage((current) => ({ ...current, [pageId]: "" }));
    } catch (error) {
      setErrorByPage((current) => ({ ...current, [pageId]: error.message }));
    } finally {
      setUploadingEditByPage((current) => ({ ...current, [pageId]: false }));
    }
  }

  async function handleEditBlockSave(pageId) {
    const editing = editingBlocks[pageId];
    if (!editing) return;

    const content = editing.content.trim();
    if (!content) return;

    try {
      const updated = await updateBlock(pageId, editing.id, {
        blockType: editing.blockType,
        content,
        sortOrder: editing.sortOrder,
      });
      setBlocksByPage((current) => ({
        ...current,
        [pageId]: (current[pageId] || []).map((block) =>
          block.id === updated.id ? updated : block
        ),
      }));
      setEditingBlocks((current) => ({ ...current, [pageId]: null }));
    } catch (error) {
      setErrorByPage((current) => ({ ...current, [pageId]: error.message }));
    }
  }

  async function handleDeleteBlock(pageId, blockId) {
    try {
      await deleteBlock(pageId, blockId);
      setBlocksByPage((current) => ({
        ...current,
        [pageId]: (current[pageId] || []).filter((block) => block.id !== blockId),
      }));
    } catch (error) {
      setErrorByPage((current) => ({ ...current, [pageId]: error.message }));
    }
  }

  const isManagePath = pathname === "/manage";

  return isManagePath ? (
    <main className="manage-view">
      <h1 className="manage-title">Manage Pages</h1>
      <p className="manage-subtitle">
        Add more pages and create text/image blocks for each page.
      </p>

      <form
        className="item-form manage-new-page"
        onSubmit={(event) => {
          event.preventDefault();
          handleAddPage();
        }}
      >
        <input
          className="item-input"
          placeholder="New page title..."
          value={newPageTitle}
          onChange={(event) => setNewPageTitle(event.target.value)}
        />
        <button type="submit" className="item-btn">
          Add Page
        </button>
      </form>

      <section className="manage-grid">
        {pages.map((page) => (
          <ManagePageCard
            key={page.id}
            page={page}
            blocks={blocksByPage[page.id] || []}
            pageTitleDraft={pageTitleDrafts[page.id] || ""}
            blockDraft={blockDrafts[page.id] || { blockType: "text", content: "" }}
            editingBlock={editingBlocks[page.id]}
            loading={Boolean(loadingByPage[page.id])}
            error={errorByPage[page.id] || ""}
            uploadingDraftImage={Boolean(uploadingDraftByPage[page.id])}
            uploadingEditingImage={Boolean(uploadingEditByPage[page.id])}
            onPageTitleDraftChange={(id, value) =>
              setPageTitleDrafts((current) => ({ ...current, [id]: value }))
            }
            onSavePageTitle={handleSavePageTitle}
            onDeletePage={handleDeletePage}
            onBlockDraftChange={(id, value) =>
              setBlockDrafts((current) => ({ ...current, [id]: value }))
            }
            onAddBlock={handleAddBlock}
            onUploadDraftImage={handleUploadDraftImage}
            onEditBlockStart={handleEditBlockStart}
            onEditBlockChange={(id, value) =>
              setEditingBlocks((current) => ({ ...current, [id]: value }))
            }
            onEditBlockSave={handleEditBlockSave}
            onEditBlockCancel={handleEditBlockCancel}
            onUploadEditingImage={handleUploadEditingImage}
            onDeleteBlock={handleDeleteBlock}
          />
        ))}
      </section>
    </main>
  ) : (
    <main className="app">
      <div className="ambient-hearts" aria-hidden="true">
        {hearts.map((heart) => (
          <span
            key={heart.id}
            className="ambient-heart"
            style={{
              left: `${heart.left}%`,
              top: `${heart.top}%`,
              fontSize: `${heart.size}px`,
              animationDuration: `${heart.duration}s`,
              animationDelay: `${heart.delay}s`,
            }}
          >
            <Heart size="1em" fill="rgba(255, 182, 193, 0.3)" stroke="rgba(255, 105, 180, 0.4)" />
          </span>
        ))}
        {sparkles.map((sparkle) => (
          <span
            key={sparkle.id}
            className="ambient-sparkle"
            style={{
              left: `${sparkle.left}%`,
              top: `${sparkle.top}%`,
              fontSize: `${sparkle.size}px`,
              animationDuration: `${sparkle.duration}s`,
              animationDelay: `${sparkle.delay}s`,
            }}
          >
            <Sparkles size="1em" color="rgba(255, 225, 126, 0.7)" />
          </span>
        ))}
      </div>

      <HTMLFlipBook
        width={360}
        height={520}
        size="stretch"
        minWidth={280}
        maxWidth={460}
        minHeight={420}
        maxHeight={620}
        maxShadowOpacity={0.35}
        showCover
        mobileScrollSupport
        className="flip-book"
      >
        <BookPage className="book-page--cover">
          <div className="cover-hearts" aria-hidden="true">
            {Array.from({ length: 14 }, (_, index) => (
              <span key={`cover-heart-${index}`}>
                <Heart
                  size="1em"
                  className="cover-heart-icon"
                  fill="rgba(255, 255, 255, 0.32)"
                  stroke="rgba(255, 255, 255, 0.75)"
                />
              </span>
            ))}
          </div>
          <p className="cover-kicker">My Valentine</p>
          <h1 className="cover-title">Valentine Flip Book</h1>
          <p className="cover-note">A little book made just for you</p>
          <p className="cover-hint">Turn the page</p>
        </BookPage>

        {pages.map((page) => (
          <BookPage key={page.id}>
            {page.title ? <h2>{page.title}</h2> : null}
            {loadingByPage[page.id] ? <p className="items-meta">Loading...</p> : null}
            {errorByPage[page.id] ? <p className="items-error">{errorByPage[page.id]}</p> : null}

            <div className="book-content">
              {(blocksByPage[page.id] || []).map((block) =>
                block.blockType === "image" ? (
                  <img
                    key={block.id}
                    src={block.content}
                    alt=""
                    className="book-image"
                    loading="lazy"
                  />
                ) : (
                  <p key={block.id} className="book-paragraph">
                    {block.content}
                  </p>
                )
              )}
            </div>

            {(blocksByPage[page.id] || []).length === 0 ? (
              <p className="items-meta">No content yet. Open `/manage` to add content.</p>
            ) : null}
          </BookPage>
        ))}
      </HTMLFlipBook>
    </main>
  );
}

export default App;
